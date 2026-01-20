import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, LineUser, Conversation, Message } from '@/models';
import { validateSignature, getUserProfile, getMessageContent } from '@/lib/line';
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

    console.log('📥 [Webhook] Received request for channel:', channelId);

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
    if (signature) {
      const isValid = validateSignature(body, signature, channel.channel_secret);
      if (!isValid) {
        console.error('❌ [Webhook] Invalid signature');
        return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhookData = JSON.parse(body);
    const events = webhookData.events || [];

    console.log('📥 [Webhook] Events count:', events.length);

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
    const lineUserId = source?.userId;
    
    if (!lineUserId) {
      console.error('No userId in event source');
      return;
    }

    try {
      // ดึงหรือสร้าง LINE User
      let lineUser = await getOrCreateLineUser(channel._id, lineUserId, channel.channel_access_token);
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

      // บันทึกข้อความ
      const savedMessage = await saveMessage(event, conversation, channel, lineUser, direction);

      // อัพเดทการสนทนา
      await updateConversation(conversation._id, message, direction);

      // ส่ง realtime notification
      await notifyNewMessage(channel._id.toString(), conversation._id.toString(), {
        id: savedMessage._id,
        direction,
        message_type: message.type,
        content: savedMessage.content,
        media_url: savedMessage.media_url,
        flex_content: savedMessage.flex_content,
        source_type: savedMessage.source_type,
        created_at: savedMessage.created_at
      });

      // Notify conversation update
      const updatedConv = await Conversation.findById(conversation._id)
        .populate('channel_id', 'channel_name picture_url basic_id')
        .populate('line_user_id', 'line_user_id display_name picture_url')
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
  // ค้นหา user ที่มีอยู่
  let existingUser = await LineUser.findOne({
    channel_id: channelId,
    line_user_id: lineUserId,
  });

  if (existingUser) {
    return existingUser;
  }

  // ดึงโปรไฟล์จาก LINE
  let profile: any = {};
  try {
    profile = await getUserProfile(accessToken, lineUserId);
  } catch (e) {
    console.error('Get profile error:', e);
  }

  // สร้าง user ใหม่
  const newUser = new LineUser({
    channel_id: channelId,
    line_user_id: lineUserId,
    display_name: profile.displayName || 'Unknown',
    picture_url: profile.pictureUrl || null,
    status_message: profile.statusMessage || null,
    language: profile.language || 'th',
  });

  await newUser.save();
  return newUser;
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

async function saveMessage(event: any, conversation: any, channel: any, lineUser: any, direction: string) {
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

  const thaiTime = new Date();

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
    created_at: thaiTime,
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

async function updateConversation(conversationId: any, message: any, direction: string) {
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

  const thaiTime = new Date();

  if (direction === 'incoming') {
    await Conversation.findByIdAndUpdate(conversationId, {
      status: 'unread',
      last_message_preview: preview.substring(0, 100),
      last_message_at: thaiTime,
      $inc: { unread_count: 1 },
    });
  } else {
    await Conversation.findByIdAndUpdate(conversationId, {
      last_message_preview: preview.substring(0, 100),
      last_message_at: thaiTime,
    });
  }

  // อัพเดท line_users.last_message_at
  const conv = await Conversation.findById(conversationId);
  if (conv) {
    await LineUser.findByIdAndUpdate(conv.line_user_id, {
      last_message_at: thaiTime,
    });
  }
}