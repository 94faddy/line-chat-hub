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
import { notifyNewMessage, notifyConversationUpdate, notifyNewConversation } from '@/lib/notifier';
import { uploadMediaFromBuffer, isCloudStorageEnabled } from '@/lib/nexzcloud';
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

    // ✅ Handle empty body (LINE verify webhook หรือ health check)
    if (!body || body.trim() === '') {
      console.log('📥 [Webhook] Empty body - likely verify request');
      return NextResponse.json({ success: true, message: 'OK' });
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

    // ✅ Safe JSON parse with error handling
    let webhookData;
    try {
      webhookData = JSON.parse(body);
    } catch (parseError) {
      console.error('❌ [Webhook] Invalid JSON body:', parseError);
      console.error('❌ [Webhook] Body content:', body.substring(0, 200));
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid JSON body' 
      }, { status: 400 });
    }

    const events = webhookData.events || [];

    console.log('📥 [Webhook] Events count:', events.length);

    // ✅ ถ้าไม่มี events (verify webhook) → return OK
    if (events.length === 0) {
      console.log('📥 [Webhook] No events - verify webhook acknowledged');
      return NextResponse.json({ success: true, message: 'No events' });
    }
    
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
      const { conversation, isNew: isNewConversation } = await getOrCreateConversation(channel._id, lineUser._id);
      if (!conversation) {
        console.error('Failed to get/create conversation');
        return;
      }

      const direction = 'incoming';

      // บันทึกข้อความ พร้อมข้อมูลคนส่ง (สำหรับกลุ่ม)
      const savedMessage = await saveMessage(event, conversation, channel, lineUser, direction, senderInfo);

      // อัพเดทการสนทนา - ✅ ส่ง event.timestamp ด้วย
      await updateConversation(conversation._id, message, direction, senderInfo, event.timestamp);

      // ✅ ถ้าเป็น conversation ใหม่ → ส่ง notifyNewConversation
      if (isNewConversation) {
        const newConvData = await Conversation.findById(conversation._id)
          .populate('channel_id', 'channel_name picture_url basic_id')
          .populate('line_user_id', 'line_user_id display_name picture_url source_type group_id room_id')
          .lean();
          
        if (newConvData) {
          console.log('📨 [Webhook] New conversation created, sending notification');
          await notifyNewConversation(channel._id.toString(), {
            id: newConvData._id,
            channel_id: newConvData.channel_id,
            line_user_id: newConvData.line_user_id,
            status: newConvData.status,
            last_message_preview: newConvData.last_message_preview,
            last_message_at: newConvData.last_message_at,
            unread_count: newConvData.unread_count,
            channel: (newConvData as any).channel_id,
            line_user: (newConvData as any).line_user_id,
          });
        }
      }

      // ส่ง realtime notification สำหรับข้อความใหม่
      await notifyNewMessage(channel._id.toString(), conversation._id.toString(), {
        id: savedMessage._id,
        message_id: savedMessage.message_id, // ✅ เพิ่ม LINE message ID
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

      // Notify conversation update (สำหรับ conversation ที่มีอยู่แล้ว)
      if (!isNewConversation) {
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
      }

    } catch (error) {
      console.error('Handle event error:', error);
    }
  }
}

async function getOrCreateLineUser(channelId: any, lineUserId: string, accessToken: string) {
  // ✅ ค้นหา user โดยไม่ต้องเช็ค source_type เพื่อรองรับ record เก่า
  let lineUser = await LineUser.findOne({
    channel_id: channelId,
    line_user_id: lineUserId,
    $or: [
      { source_type: 'user' },
      { source_type: { $exists: false } },
      { source_type: null }
    ]
  });

  if (!lineUser) {
    // ดึงข้อมูล Profile จาก LINE
    let profile: any = {};
    try {
      profile = await getUserProfile(accessToken, lineUserId);
    } catch (e) {
      console.error('Get user profile error:', e);
    }

    // สร้าง LINE User ใหม่
    lineUser = new LineUser({
      channel_id: channelId,
      line_user_id: lineUserId,
      display_name: profile.displayName || 'Unknown',
      picture_url: profile.pictureUrl || null,
      status_message: profile.statusMessage || null,
      source_type: 'user',
      last_message_at: new Date(),
    });

    await lineUser.save();
    console.log('✅ [Webhook] Created new LINE user:', lineUser.display_name);
  } else {
    // ✅ อัพเดท source_type ถ้ายังไม่มี
    if (!lineUser.source_type) {
      lineUser.source_type = 'user';
      await lineUser.save();
    }
  }

  return lineUser;
}

async function getOrCreateGroupOrRoom(
  channelId: any, 
  targetId: string, 
  sourceType: 'group' | 'room',
  accessToken: string
) {
  // ค้นหา Group/Room ที่มีอยู่
  const query: any = {
    channel_id: channelId,
    source_type: sourceType,
  };
  
  if (sourceType === 'group') {
    query.group_id = targetId;
  } else {
    query.room_id = targetId;
  }
  
  let lineUser = await LineUser.findOne(query);

  if (!lineUser) {
    // สร้างใหม่
    let groupInfo: any = {};
    let memberCount = 0;
    
    if (sourceType === 'group') {
      try {
        groupInfo = await getGroupSummary(accessToken, targetId);
        memberCount = await getGroupMemberCount(accessToken, targetId);
      } catch (e) {
        console.error('❌ [Webhook] Get group info error:', e);
      }
    }

    lineUser = new LineUser({
      channel_id: channelId,
      line_user_id: targetId, // ใช้ targetId เป็น line_user_id สำหรับ group/room
      display_name: groupInfo.groupName || (sourceType === 'group' ? 'กลุ่มไลน์' : 'ห้องแชท'),
      picture_url: groupInfo.pictureUrl || null,
      source_type: sourceType,
      group_id: sourceType === 'group' ? targetId : undefined,
      room_id: sourceType === 'room' ? targetId : undefined,
      member_count: memberCount,
      last_message_at: new Date(),
    });

    await lineUser.save();
    console.log(`✅ [Webhook] Created new ${sourceType}:`, lineUser.display_name);
  }

  return lineUser;
}

async function getSenderInfo(
  accessToken: string,
  sourceType: 'group' | 'room',
  targetId: string,
  userId: string
) {
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

async function getOrCreateConversation(channelId: any, lineUserId: any): Promise<{ conversation: any; isNew: boolean }> {
  // ค้นหาการสนทนาที่มีอยู่
  let existingConv = await Conversation.findOne({
    channel_id: channelId,
    line_user_id: lineUserId,
  });

  if (existingConv) {
    return { conversation: existingConv, isNew: false };
  }

  // สร้างการสนทนาใหม่
  const newConv = new Conversation({
    channel_id: channelId,
    line_user_id: lineUserId,
    status: 'unread',
    unread_count: 1,
  });

  await newConv.save();
  return { conversation: newConv, isNew: true };
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
    
    // ✅ ถ้าเปิดใช้ Cloud Storage → upload ไป NexzCloud
    if (isCloudStorageEnabled()) {
      console.log(`☁️ [Webhook] Uploading to NexzCloud: ${mediaType}`);
      const cloudUrl = await uploadMediaFromBuffer(mediaContent, mediaType, uuidv4());
      
      if (cloudUrl) {
        console.log(`✅ [Webhook] Cloud URL: ${cloudUrl}`);
        return cloudUrl;
      }
      
      console.log(`⚠️ [Webhook] Cloud upload failed, falling back to local storage`);
    }
    
    // Fallback: Local storage
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