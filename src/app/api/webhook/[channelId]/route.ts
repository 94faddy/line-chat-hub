import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateSignature, getUserProfile, getMessageContent } from '@/lib/line';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface RouteParams {
  params: { channelId: string };
}

// POST - รับ Webhook จาก LINE
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    // ดึงข้อมูล Channel
    const channels = await query(
      'SELECT * FROM line_channels WHERE channel_id = ? AND status = "active"',
      [params.channelId]
    );

    if (!Array.isArray(channels) || channels.length === 0) {
      console.error('Channel not found:', params.channelId);
      return NextResponse.json({ success: false, message: 'Channel not found' }, { status: 404 });
    }

    const channel = channels[0] as any;

    // ตรวจสอบ Signature
    if (signature) {
      const isValid = validateSignature(body, signature, channel.channel_secret);
      if (!isValid) {
        console.error('Invalid signature');
        return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 401 });
      }
    }

    const webhookData = JSON.parse(body);
    const events = webhookData.events || [];

    for (const event of events) {
      await handleEvent(event, channel);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}

async function handleEvent(event: any, channel: any) {
  const { type, source, message, replyToken, timestamp, deliveryContext } = event;

  // รองรับ message events ทั้งจาก user และ bot
  if (type === 'message') {
    const lineUserId = source?.userId;
    
    if (!lineUserId) {
      console.error('No userId in event source');
      return;
    }

    try {
      // ดึงหรือสร้าง LINE User
      let lineUser = await getOrCreateLineUser(channel.id, lineUserId, channel.channel_access_token);
      if (!lineUser) {
        console.error('Failed to get/create LINE user');
        return;
      }

      // ดึงหรือสร้าง Conversation
      let conversation = await getOrCreateConversation(channel.id, lineUser.id);
      if (!conversation) {
        console.error('Failed to get/create conversation');
        return;
      }

      // ตรวจสอบว่าเป็นข้อความจาก bot หรือ user
      // LINE sends webhooks for bot-sent messages when "Use webhooks to receive sent messages" is enabled
      const isFromBot = deliveryContext?.isRedelivery === false && 
                        source?.type === 'user' && 
                        (message?.sender?.type === 'bot' || event.webhookEventId?.includes('send'));
      const direction = isFromBot ? 'outgoing' : 'incoming';

      // บันทึกข้อความ
      const savedMessage = await saveMessage(event, conversation, channel, lineUser, direction);

      // อัพเดทการสนทนา
      await updateConversation(conversation.id, message, direction);

      // ส่ง realtime notification
      await notifyNewMessage(channel.id, conversation.id, {
        id: savedMessage.id,
        direction,
        message_type: message.type,
        content: savedMessage.content,
        media_url: savedMessage.media_url,
        flex_content: savedMessage.flex_content,
        source_type: savedMessage.source_type,
        created_at: savedMessage.created_at
      });

      // Notify conversation update
      const updatedConv = await getConversationById(conversation.id);
      if (updatedConv) {
        await notifyConversationUpdate(channel.id, updatedConv);
      }

    } catch (error) {
      console.error('Handle event error:', error);
    }
  }
  
  // รองรับ bot send events (เมื่อ bot ส่งข้อความออกไป) - ต้องเปิดใน LINE Console
  if (type === 'botMessage' || type === 'delivery') {
    console.log('Bot message/delivery event:', JSON.stringify(event));
    // Process bot sent message
    await handleBotSentMessage(event, channel);
  }
}

// Handle bot sent messages (requires "Use webhooks to receive sent messages" enabled in LINE Console)
async function handleBotSentMessage(event: any, channel: any) {
  const { message, deliveryContext } = event;
  
  if (!message || !deliveryContext?.destination) return;
  
  const lineUserId = deliveryContext.destination;
  
  try {
    // ค้นหา user
    const users = await query(
      'SELECT * FROM line_users WHERE channel_id = ? AND line_user_id = ?',
      [channel.id, lineUserId]
    );
    
    if (!Array.isArray(users) || users.length === 0) return;
    
    const lineUser = users[0] as any;
    
    // ค้นหา conversation
    const conversations = await query(
      'SELECT * FROM conversations WHERE channel_id = ? AND line_user_id = ?',
      [channel.id, lineUser.id]
    );
    
    if (!Array.isArray(conversations) || conversations.length === 0) return;
    
    const conversation = conversations[0] as any;
    
    // บันทึกข้อความ bot
    const savedMessage = await saveMessage(
      { message, replyToken: null },
      conversation,
      channel,
      lineUser,
      'outgoing'
    );
    
    // อัพเดทการสนทนา
    await updateConversation(conversation.id, message, 'outgoing');
    
    // ส่ง notification
    await notifyNewMessage(channel.id, conversation.id, {
      id: savedMessage.id,
      direction: 'outgoing',
      message_type: message.type,
      content: savedMessage.content,
      media_url: savedMessage.media_url,
      flex_content: savedMessage.flex_content,
      source_type: 'bot_reply',
      created_at: savedMessage.created_at
    });
    
  } catch (error) {
    console.error('Handle bot sent message error:', error);
  }
}

async function getOrCreateLineUser(channelId: number, lineUserId: string, accessToken: string) {
  // ค้นหา user ที่มีอยู่
  const existingUsers = await query(
    'SELECT * FROM line_users WHERE channel_id = ? AND line_user_id = ?',
    [channelId, lineUserId]
  );

  if (Array.isArray(existingUsers) && existingUsers.length > 0) {
    return existingUsers[0] as any;
  }

  // ดึงโปรไฟล์จาก LINE
  let profile: any = {};
  try {
    profile = await getUserProfile(accessToken, lineUserId);
  } catch (e) {
    console.error('Get profile error:', e);
  }

  // สร้าง user ใหม่
  const result: any = await query(
    `INSERT INTO line_users (channel_id, line_user_id, display_name, picture_url, status_message, language)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      channelId,
      lineUserId,
      profile.displayName || 'Unknown',
      profile.pictureUrl || null,
      profile.statusMessage || null,
      profile.language || 'th'
    ]
  );

  return {
    id: result.insertId,
    channel_id: channelId,
    line_user_id: lineUserId,
    display_name: profile.displayName || 'Unknown',
    picture_url: profile.pictureUrl
  };
}

async function getOrCreateConversation(channelId: number, lineUserId: number) {
  // ค้นหาการสนทนาที่มีอยู่
  const existingConvs = await query(
    'SELECT * FROM conversations WHERE channel_id = ? AND line_user_id = ?',
    [channelId, lineUserId]
  );

  if (Array.isArray(existingConvs) && existingConvs.length > 0) {
    return existingConvs[0] as any;
  }

  // สร้างการสนทนาใหม่
  const result: any = await query(
    `INSERT INTO conversations (channel_id, line_user_id, status, unread_count)
     VALUES (?, ?, 'unread', 1)`,
    [channelId, lineUserId]
  );

  return {
    id: result.insertId,
    channel_id: channelId,
    line_user_id: lineUserId
  };
}

async function getConversationById(conversationId: number) {
  const conversations = await query(
    `SELECT 
      c.*,
      ch.channel_name, ch.picture_url as channel_picture_url, ch.basic_id,
      lu.display_name, lu.picture_url as user_picture_url, lu.line_user_id
     FROM conversations c
     INNER JOIN line_channels ch ON c.channel_id = ch.id
     INNER JOIN line_users lu ON c.line_user_id = lu.id
     WHERE c.id = ?`,
    [conversationId]
  );

  if (Array.isArray(conversations) && conversations.length > 0) {
    const conv = conversations[0] as any;
    return {
      id: conv.id,
      channel_id: conv.channel_id,
      line_user_id: conv.line_user_id,
      status: conv.status,
      last_message_preview: conv.last_message_preview,
      last_message_at: conv.last_message_at,
      unread_count: conv.unread_count,
      channel: {
        id: conv.channel_id,
        channel_name: conv.channel_name,
        picture_url: conv.channel_picture_url,
        basic_id: conv.basic_id
      },
      line_user: {
        id: conv.line_user_id,
        display_name: conv.display_name,
        picture_url: conv.user_picture_url,
        line_user_id: conv.line_user_id
      }
    };
  }
  return null;
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
      // ดาวน์โหลดและเก็บไฟล์จาก LINE
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
      // บันทึก flex message content
      flexContent = JSON.stringify(message.contents || message);
      content = message.altText || '[Flex Message]';
      break;
    case 'template':
      // บันทึก template message
      flexContent = JSON.stringify(message.template || message);
      content = message.altText || '[Template Message]';
      break;
    default:
      content = `[${message.type}]`;
  }

  // ใช้เวลา Thailand timezone
  const thaiTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T');

  const result: any = await query(
    `INSERT INTO messages 
     (conversation_id, channel_id, line_user_id, message_id, direction, message_type, 
      content, media_url, sticker_id, package_id, flex_content, reply_token, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conversation.id,
      channel.id,
      lineUser.id,
      message.id,
      direction,
      messageType,
      content,
      mediaUrl,
      stickerId,
      packageId,
      flexContent,
      replyToken || null,
      sourceType,
      thaiTime
    ]
  );

  return {
    id: result.insertId,
    content,
    media_url: mediaUrl,
    flex_content: flexContent,
    source_type: sourceType,
    created_at: thaiTime
  };
}

async function downloadAndStoreMedia(accessToken: string, messageId: string, mediaType: string) {
  try {
    const mediaContent = await getMessageContent(accessToken, messageId);
    
    // กำหนด extension ตาม media type
    let ext = '.bin';
    switch (mediaType) {
      case 'image':
        ext = '.jpg';
        break;
      case 'video':
        ext = '.mp4';
        break;
      case 'audio':
        ext = '.m4a';
        break;
      case 'file':
        ext = '.bin';
        break;
    }

    const filename = `${uuidv4()}${ext}`;
    
    // สร้างโฟลเดอร์ตามวันที่
    const today = new Date();
    const dateFolder = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', dateFolder);

    // สร้างโฟลเดอร์ถ้ายังไม่มี
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // บันทึกไฟล์
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, mediaContent);

    // สร้าง URL
    const fileUrl = `${process.env.NEXT_PUBLIC_APP_URL}/uploads/${dateFolder}/${filename}`;

    return fileUrl;
  } catch (error) {
    console.error('Download media error:', error);
    throw error;
  }
}

async function updateConversation(conversationId: number, message: any, direction: string) {
  let preview = '';
  switch (message.type) {
    case 'text':
      preview = message.text;
      break;
    case 'image':
      preview = '[รูปภาพ]';
      break;
    case 'video':
      preview = '[วิดีโอ]';
      break;
    case 'audio':
      preview = '[เสียง]';
      break;
    case 'sticker':
      preview = '[สติกเกอร์]';
      break;
    case 'location':
      preview = '[ตำแหน่ง]';
      break;
    case 'file':
      preview = '[ไฟล์]';
      break;
    case 'flex':
      preview = message.altText || '[Flex Message]';
      break;
    case 'template':
      preview = message.altText || '[Template]';
      break;
    default:
      preview = `[${message.type}]`;
  }

  // ใช้เวลา Thailand timezone
  const thaiTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T');

  // ถ้าเป็นข้อความขาเข้า ให้เพิ่ม unread_count
  if (direction === 'incoming') {
    await query(
      `UPDATE conversations 
       SET status = 'unread', 
           last_message_preview = ?, 
           last_message_at = ?, 
           unread_count = unread_count + 1 
       WHERE id = ?`,
      [preview.substring(0, 100), thaiTime, conversationId]
    );
  } else {
    // ถ้าเป็นข้อความขาออก (จาก bot) แค่อัพเดท preview และเวลา
    await query(
      `UPDATE conversations 
       SET last_message_preview = ?, 
           last_message_at = ?
       WHERE id = ?`,
      [preview.substring(0, 100), thaiTime, conversationId]
    );
  }

  // อัพเดท line_users.last_message_at
  await query(
    `UPDATE line_users lu
     INNER JOIN conversations c ON c.line_user_id = lu.id
     SET lu.last_message_at = ?
     WHERE c.id = ?`,
    [thaiTime, conversationId]
  );
}
