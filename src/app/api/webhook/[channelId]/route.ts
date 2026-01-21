/**
 * ============================================================
 * 📁 PATH: src/app/api/webhook/[channelId]/route.ts
 * 📝 DESCRIPTION: รับ Webhook จาก LINE Platform
 * 🔑 PARAM: channelId (LINE Channel ID เช่น "2007183189")
 * ============================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, LineUser, Conversation, Message } from '@/models';
import { 
  validateSignature, 
  getUserProfile, 
  getMessageContent,
  getGroupMemberProfile,
  getRoomMemberProfile,
  getGroupSummary,
  getGroupMemberCount
} from '@/lib/line';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface RouteParams {
  params: Promise<{ channelId: string }>;
}

// POST - รับ Webhook จาก LINE
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    
    const { channelId } = await params;
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');
    
    // ✅ ดึง channel_id จาก header (ถ้า Bot ส่งมา)
    const channelIdFromHeader = request.headers.get('x-line-channel-id');

    console.log('📥 [Webhook] Received request for channel:', channelId);
    if (channelIdFromHeader) {
      console.log('📥 [Webhook] Channel ID from header:', channelIdFromHeader);
    }

    // ✅ ถ้ามี header และไม่ตรงกับ URL → Skip (webhook มาจาก channel อื่น)
    if (channelIdFromHeader && channelIdFromHeader !== channelId) {
      console.log(`⚠️ [Webhook] Channel mismatch - Header: ${channelIdFromHeader}, URL: ${channelId} - Skipping`);
      return NextResponse.json({ 
        success: true, 
        message: 'Skipped - channel mismatch',
        expected: channelId,
        received: channelIdFromHeader
      });
    }

    // ดึงข้อมูล Channel
    const channel = await LineChannel.findOne({
      channel_id: channelId,
      status: 'active',
    });

    if (!channel) {
      console.error('❌ [Webhook] Channel not found:', channelId);
      return NextResponse.json({ success: false, message: 'Channel not found' }, { status: 404 });
    }

    console.log('✅ [Webhook] Channel found:', channel.channel_name);

    // ตรวจสอบ Signature
    let signatureValid = true;
    if (signature) {
      const isValid = validateSignature(body, signature, channel.channel_secret);
      if (!isValid) {
        console.warn('⚠️ [Webhook] Invalid signature - may be from Liff share or forwarded webhook');
        signatureValid = false;
        // ✅ ไม่ return error ทันที - ให้ลอง process ต่อสำหรับ Liff share
      }
    }

    const webhookData = JSON.parse(body);
    const events = webhookData.events || [];

    console.log('📥 [Webhook] Events count:', events.length);
    
    // ✅ Log event types เพื่อ debug
    if (!signatureValid && events.length > 0) {
      console.log('📥 [Webhook] Event types (invalid sig):', events.map((e: any) => `${e.type}:${e.message?.type || e.postback?.data || 'N/A'}`).join(', '));
    }

    for (const event of events) {
      await handleEvent(event, channel);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ [Webhook] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}

async function handleEvent(event: any, channel: any) {
  const { type, source, message, replyToken, deliveryContext } = event;

  if (type === 'message') {
    const sourceType = source?.type || 'user'; // user, group, room
    const lineUserId = source?.userId;
    const groupId = source?.groupId;
    const roomId = source?.roomId;
    
    console.log('📥 [Webhook] Source type:', sourceType);
    console.log('📥 [Webhook] User ID:', lineUserId);
    console.log('📥 [Webhook] Group ID:', groupId);
    console.log('📥 [Webhook] Room ID:', roomId);

    // ⚠️ ในกลุ่ม/ห้อง บางครั้ง userId อาจเป็น null (เช่น bot join event)
    // แต่สำหรับ message event ควรมี userId เสมอ
    if (!lineUserId && sourceType === 'user') {
      console.error('No userId in event source');
      return;
    }

    try {
      let lineUser: any;
      let senderInfo: any = null;

      if (sourceType === 'group' || sourceType === 'room') {
        // ✅ Handle Group/Room messages
        const targetId = groupId || roomId;
        
        // ดึงหรือสร้าง LINE User สำหรับ Group/Room
        lineUser = await getOrCreateGroupOrRoom(
          channel._id, 
          targetId!, 
          sourceType as 'group' | 'room',
          channel.channel_access_token
        );
        
        // ดึงข้อมูลคนส่งในกลุ่ม (ถ้ามี userId)
        if (lineUserId) {
          senderInfo = await getSenderInfo(
            channel.channel_access_token,
            sourceType as 'group' | 'room',
            targetId!,
            lineUserId
          );
          console.log('📥 [Webhook] Sender info:', senderInfo);
        }
      } else {
        // Handle individual user messages (1:1 chat)
        lineUser = await getOrCreateLineUser(channel._id, lineUserId, channel.channel_access_token);
      }

      if (!lineUser) {
        console.error('Failed to get/create LINE user');
        return;
      }

      // ดึงหรือสร้าง Conversation
      let conversation = await getOrCreateConversation(channel._id, lineUser._id);
      if (!conversation) {
        console.error('Failed to get/create conversation');
        return;
      }

      const direction = 'incoming';

      // บันทึกข้อความ พร้อมข้อมูลคนส่ง (สำหรับกลุ่ม)
      const savedMessage = await saveMessage(event, conversation, channel, lineUser, direction, senderInfo);

      // อัพเดทการสนทนา - ✅ ส่ง event.timestamp ด้วย
      await updateConversation(conversation._id, message, direction, senderInfo, event.timestamp);

      // ส่ง realtime notification
      await notifyNewMessage(channel._id.toString(), conversation._id.toString(), {
        id: savedMessage._id,
        direction,
        message_type: message.type,
        content: savedMessage.content,
        media_url: savedMessage.media_url,
        flex_content: savedMessage.flex_content,
        sticker_id: savedMessage.sticker_id,
        package_id: savedMessage.package_id,
        source_type: savedMessage.source_type,
        sender_info: savedMessage.sender_info, // ✅ ส่งข้อมูลคนส่ง
        created_at: savedMessage.created_at
      });

      // Notify conversation update
      const updatedConv = await Conversation.findById(conversation._id)
        .populate('channel_id', 'channel_name picture_url basic_id')
        .populate('line_user_id', 'line_user_id display_name picture_url source_type group_id room_id')
        .lean();
        
      if (updatedConv) {
        await notifyConversationUpdate(channel._id.toString(), {
          id: updatedConv._id,
          status: updatedConv.status,
          last_message_preview: updatedConv.last_message_preview,
          last_message_at: updatedConv.last_message_at,
          unread_count: updatedConv.unread_count,
        });
      }

    } catch (error) {
      console.error('Handle event error:', error);
    }
  }
}

async function getOrCreateLineUser(channelId: any, lineUserId: string, accessToken: string) {
  // ✅ ค้นหา user โดยไม่ต้องเช็ค source_type เพื่อรองรับ record เก่า
  let existingUser = await LineUser.findOne({
    channel_id: channelId,
    line_user_id: lineUserId,
  });

  if (existingUser) {
    // ✅ อัพเดท source_type ถ้ายังไม่มี
    if (!existingUser.source_type) {
      existingUser.source_type = 'user';
      await existingUser.save();
    }
    
    // ⭐ ถ้าได้รับข้อความจาก user แสดงว่ายังติดตามอยู่
    // ถ้า display_name เป็น null/Unknown ลองดึง profile ใหม่
    if (!existingUser.display_name || existingUser.display_name === 'Unknown') {
      try {
        const profile = await getUserProfile(accessToken, lineUserId);
        if (profile && profile.displayName) {
          existingUser.display_name = profile.displayName;
          existingUser.picture_url = profile.pictureUrl || existingUser.picture_url;
          existingUser.status_message = profile.statusMessage || existingUser.status_message;
          existingUser.follow_status = 'following';
          await existingUser.save();
          console.log('✅ [Webhook] Updated user profile:', profile.displayName);
        }
      } catch (e) {
        console.error('❌ [Webhook] Retry get profile error:', e);
      }
    } else {
      // ⭐ User ส่งข้อความมา แสดงว่ายังติดตามอยู่
      if (existingUser.follow_status !== 'following') {
        existingUser.follow_status = 'following';
        await existingUser.save();
        console.log('✅ [Webhook] User re-followed, status updated');
      }
    }
    return existingUser;
  }

  // ดึงโปรไฟล์จาก LINE
  let profile: any = {};
  let followStatus: 'following' | 'unfollowed' | 'blocked' | 'unknown' = 'following';
  
  try {
    profile = await getUserProfile(accessToken, lineUserId);
    console.log('✅ [Webhook] Got user profile:', profile.displayName);
  } catch (e: any) {
    console.error('❌ [Webhook] Get profile error:', e);
    // ถ้า user ส่งข้อความมาได้ แต่ดึง profile ไม่ได้ อาจจะปิด privacy
    followStatus = 'unknown';
  }

  // สร้าง user ใหม่
  const newUser = new LineUser({
    channel_id: channelId,
    line_user_id: lineUserId,
    display_name: profile.displayName || null,
    picture_url: profile.pictureUrl || null,
    status_message: profile.statusMessage || null,
    language: profile.language || 'th',
    follow_status: profile.displayName ? 'following' : followStatus,
    source_type: 'user', // ✅ ระบุว่าเป็น user
  });

  await newUser.save();
  return newUser;
}

// ✅ ฟังก์ชันสำหรับสร้าง/ดึง Group หรือ Room
async function getOrCreateGroupOrRoom(
  channelId: any, 
  targetId: string, 
  sourceType: 'group' | 'room',
  accessToken: string
) {
  // ✅ ค้นหาโดยใช้ line_user_id (groupId/roomId) โดยไม่ต้องเช็ค source_type
  // เพื่อรองรับ record เก่าที่ไม่มี source_type
  let existing = await LineUser.findOne({
    channel_id: channelId,
    line_user_id: targetId,
  });

  if (existing) {
    // ✅ ถ้าเจอ record เก่า ให้อัพเดท source_type และ group_id/room_id
    if (!existing.source_type || existing.source_type === 'user') {
      existing.source_type = sourceType;
      if (sourceType === 'group') {
        existing.group_id = targetId;
      } else {
        existing.room_id = targetId;
      }
      
      // ดึงข้อมูลกลุ่มจาก LINE
      if (sourceType === 'group') {
        try {
          const groupInfo = await getGroupSummary(accessToken, targetId);
          const memberCount = await getGroupMemberCount(accessToken, targetId);
          existing.display_name = groupInfo.groupName || existing.display_name;
          existing.picture_url = groupInfo.pictureUrl || existing.picture_url;
          existing.member_count = memberCount;
        } catch (e) {
          console.error('❌ [Webhook] Update group info error:', e);
        }
      }
      
      await existing.save();
      console.log('✅ [Webhook] Updated existing record to', sourceType, ':', existing.display_name);
    }
    return existing;
  }

  // ดึงข้อมูลกลุ่มจาก LINE
  let groupInfo: any = {};
  let memberCount = 0;
  
  if (sourceType === 'group') {
    try {
      groupInfo = await getGroupSummary(accessToken, targetId);
      memberCount = await getGroupMemberCount(accessToken, targetId);
      console.log('✅ [Webhook] Got group info:', groupInfo.groupName);
    } catch (e) {
      console.error('❌ [Webhook] Get group info error:', e);
    }
  }

  // สร้าง entry ใหม่สำหรับ group/room
  const newEntry = new LineUser({
    channel_id: channelId,
    line_user_id: targetId, // ใช้ groupId/roomId เป็น line_user_id
    display_name: groupInfo.groupName || `${sourceType === 'group' ? 'กลุ่ม' : 'ห้อง'} ${targetId.substring(0, 8)}...`,
    picture_url: groupInfo.pictureUrl || null,
    source_type: sourceType,
    group_id: sourceType === 'group' ? targetId : undefined,
    room_id: sourceType === 'room' ? targetId : undefined,
    member_count: memberCount,
    follow_status: 'following',
  });

  await newEntry.save();
  console.log('✅ [Webhook] Created new', sourceType, ':', newEntry.display_name);
  return newEntry;
}

// ✅ ฟังก์ชันดึงข้อมูลคนส่งในกลุ่ม/ห้อง
async function getSenderInfo(
  accessToken: string,
  sourceType: 'group' | 'room',
  targetId: string,
  userId: string
): Promise<{ user_id: string; display_name?: string; picture_url?: string }> {
  try {
    let profile: any;
    
    if (sourceType === 'group') {
      profile = await getGroupMemberProfile(accessToken, targetId, userId);
    } else {
      profile = await getRoomMemberProfile(accessToken, targetId, userId);
    }
    
    return {
      user_id: userId,
      display_name: profile.displayName,
      picture_url: profile.pictureUrl,
    };
  } catch (e) {
    console.error('❌ [Webhook] Get sender profile error:', e);
    // ถ้าดึง profile ไม่ได้ ส่งกลับแค่ userId
    return {
      user_id: userId,
      display_name: undefined,
      picture_url: undefined,
    };
  }
}

async function getOrCreateConversation(channelId: any, lineUserId: any) {
  // ค้นหาการสนทนาที่มีอยู่
  let existingConv = await Conversation.findOne({
    channel_id: channelId,
    line_user_id: lineUserId,
  });

  if (existingConv) {
    return existingConv;
  }

  // สร้างการสนทนาใหม่
  const newConv = new Conversation({
    channel_id: channelId,
    line_user_id: lineUserId,
    status: 'unread',
    unread_count: 1,
  });

  await newConv.save();
  return newConv;
}

async function saveMessage(event: any, conversation: any, channel: any, lineUser: any, direction: string, senderInfo?: any) {
  const { message, replyToken } = event;

  let content = null;
  let mediaUrl = null;
  let messageType = message.type;
  let stickerId = null;
  let packageId = null;
  let flexContent = null;
  let sourceType = direction === 'outgoing' ? 'bot_reply' : 'manual';

  switch (message.type) {
    case 'text':
      content = message.text;
      break;
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      try {
        mediaUrl = await downloadAndStoreMedia(channel.channel_access_token, message.id, message.type);
      } catch (e) {
        console.error('Failed to download media:', e);
        mediaUrl = `https://api-data.line.me/v2/bot/message/${message.id}/content`;
      }
      break;
    case 'sticker':
      stickerId = message.stickerId;
      packageId = message.packageId;
      break;
    case 'location':
      content = JSON.stringify({
        title: message.title,
        address: message.address,
        latitude: message.latitude,
        longitude: message.longitude
      });
      break;
    case 'flex':
      flexContent = message.contents || message;
      content = message.altText || '[Flex Message]';
      break;
    case 'template':
      flexContent = message.template || message;
      content = message.altText || '[Template Message]';
      break;
    default:
      content = `[${message.type}]`;
  }

  // ✅ ใช้ timestamp จาก LINE event แทน new Date() เพื่อให้ลำดับถูกต้อง
  const messageTime = event.timestamp ? new Date(event.timestamp) : new Date();
  console.log('⏰ [Webhook] Message timestamp:', messageTime.toISOString());

  const newMessage = new Message({
    conversation_id: conversation._id,
    channel_id: channel._id,
    line_user_id: lineUser._id,
    message_id: message.id,
    direction,
    message_type: messageType,
    content,
    media_url: mediaUrl,
    sticker_id: stickerId,
    package_id: packageId,
    flex_content: flexContent,
    reply_token: replyToken || null,
    source_type: sourceType,
    sender_info: senderInfo || null, // ✅ เพิ่มข้อมูลคนส่ง
    created_at: messageTime,
  });

  await newMessage.save();

  return newMessage;
}

async function downloadAndStoreMedia(accessToken: string, messageId: string, mediaType: string) {
  try {
    const mediaContent = await getMessageContent(accessToken, messageId);
    
    let ext = '.bin';
    switch (mediaType) {
      case 'image': ext = '.jpg'; break;
      case 'video': ext = '.mp4'; break;
      case 'audio': ext = '.m4a'; break;
      case 'file': ext = '.bin'; break;
    }

    const filename = `${uuidv4()}${ext}`;
    
    const today = new Date();
    const dateFolder = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', dateFolder);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, mediaContent);

    const fileUrl = `${process.env.NEXT_PUBLIC_APP_URL}/uploads/${dateFolder}/${filename}`;
    return fileUrl;
  } catch (error) {
    console.error('Download media error:', error);
    throw error;
  }
}

async function updateConversation(conversationId: any, message: any, direction: string, senderInfo?: any, eventTimestamp?: number) {
  let preview = '';
  switch (message.type) {
    case 'text': preview = message.text; break;
    case 'image': preview = '[รูปภาพ]'; break;
    case 'video': preview = '[วิดีโอ]'; break;
    case 'audio': preview = '[เสียง]'; break;
    case 'sticker': preview = '[สติกเกอร์]'; break;
    case 'location': preview = '[ตำแหน่ง]'; break;
    case 'file': preview = '[ไฟล์]'; break;
    case 'flex': preview = message.altText || '[Flex Message]'; break;
    case 'template': preview = message.altText || '[Template]'; break;
    default: preview = `[${message.type}]`;
  }

  // ✅ ถ้าเป็นข้อความจากกลุ่ม ให้แสดงชื่อคนส่งด้วย
  if (senderInfo && senderInfo.display_name) {
    preview = `${senderInfo.display_name}: ${preview}`;
  }

  // ✅ ใช้ timestamp จาก LINE event
  const messageTime = eventTimestamp ? new Date(eventTimestamp) : new Date();

  if (direction === 'incoming') {
    // ✅ Step 1: Increment unread_count เสมอ (ไม่มีเงื่อนไข timestamp)
    await Conversation.findByIdAndUpdate(conversationId, {
      status: 'unread',
      $inc: { unread_count: 1 },
    });
    
    // ✅ Step 2: Update preview และ last_message_at เฉพาะเมื่อ timestamp ใหม่กว่า
    await Conversation.findOneAndUpdate(
      { 
        _id: conversationId,
        $or: [
          { last_message_at: { $lt: messageTime } },
          { last_message_at: null }
        ]
      },
      {
        last_message_preview: preview.substring(0, 100),
        last_message_at: messageTime,
      }
    );
  } else {
    // Outgoing: update เฉพาะเมื่อ timestamp ใหม่กว่า
    await Conversation.findOneAndUpdate(
      { 
        _id: conversationId,
        $or: [
          { last_message_at: { $lt: messageTime } },
          { last_message_at: null }
        ]
      },
      {
        last_message_preview: preview.substring(0, 100),
        last_message_at: messageTime,
      }
    );
  }

  // อัพเดท line_users.last_message_at
  const conv = await Conversation.findById(conversationId);
  if (conv) {
    await LineUser.findByIdAndUpdate(conv.line_user_id, {
      last_message_at: messageTime,
    });
  }
}