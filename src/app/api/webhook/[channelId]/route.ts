import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { validateSignature, getUserProfile, getMessageContent, replyMessage } from '@/lib/line';
import crypto from 'crypto';

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
  const { type, source, message, replyToken, timestamp } = event;

  if (type !== 'message' || source?.type !== 'user') {
    return;
  }

  const lineUserId = source.userId;

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

    // บันทึกข้อความ
    await saveMessage(event, conversation, channel, lineUser);

    // อัพเดทการสนทนา
    await updateConversation(conversation.id, message);

    // ตรวจสอบ Auto-Reply
    if (message.type === 'text' && replyToken) {
      await checkAndSendAutoReply(message.text, channel, replyToken);
    }

  } catch (error) {
    console.error('Handle event error:', error);
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

async function saveMessage(event: any, conversation: any, channel: any, lineUser: any) {
  const { message, replyToken } = event;

  let content = null;
  let mediaUrl = null;
  let messageType = message.type;
  let stickerId = null;
  let packageId = null;

  switch (message.type) {
    case 'text':
      content = message.text;
      break;
    case 'image':
    case 'video':
    case 'audio':
    case 'file':
      // สำหรับ media จะต้องดึง content จาก LINE
      mediaUrl = `https://api-data.line.me/v2/bot/message/${message.id}/content`;
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
    default:
      content = `[${message.type}]`;
  }

  await query(
    `INSERT INTO messages 
     (conversation_id, channel_id, line_user_id, message_id, direction, message_type, content, media_url, sticker_id, package_id, reply_token)
     VALUES (?, ?, ?, ?, 'incoming', ?, ?, ?, ?, ?, ?)`,
    [
      conversation.id,
      channel.id,
      lineUser.id,
      message.id,
      messageType,
      content,
      mediaUrl,
      stickerId,
      packageId,
      replyToken
    ]
  );
}

async function updateConversation(conversationId: number, message: any) {
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
    default:
      preview = `[${message.type}]`;
  }

  await query(
    `UPDATE conversations 
     SET status = 'unread', 
         last_message_preview = ?, 
         last_message_at = NOW(), 
         unread_count = unread_count + 1 
     WHERE id = ?`,
    [preview.substring(0, 100), conversationId]
  );

  // อัพเดท line_users.last_message_at
  await query(
    `UPDATE line_users lu
     INNER JOIN conversations c ON c.line_user_id = lu.id
     SET lu.last_message_at = NOW()
     WHERE c.id = ?`,
    [conversationId]
  );
}

// ตรวจสอบและส่ง Auto-Reply
async function checkAndSendAutoReply(text: string, channel: any, replyToken: string) {
  try {
    // ดึง auto-reply rules ที่ active สำหรับ channel นี้หรือ global
    const rules = await query(
      `SELECT * FROM auto_replies 
       WHERE is_active = 1 
       AND (channel_id = ? OR channel_id IS NULL)
       ORDER BY priority DESC, id ASC`,
      [channel.id]
    );

    if (!Array.isArray(rules) || rules.length === 0) {
      return;
    }

    const lowerText = text.toLowerCase();

    for (const rule of rules as any[]) {
      let matched = false;
      const keyword = rule.keyword.toLowerCase();

      switch (rule.match_type) {
        case 'exact':
          matched = lowerText === keyword;
          break;
        case 'contains':
          matched = lowerText.includes(keyword);
          break;
        case 'starts_with':
          matched = lowerText.startsWith(keyword);
          break;
        case 'regex':
          try {
            const regex = new RegExp(rule.keyword, 'i');
            matched = regex.test(text);
          } catch (e) {
            console.error('Invalid regex:', rule.keyword);
          }
          break;
      }

      if (matched) {
        // ส่งข้อความตอบกลับ
        const messages = [];
        
        if (rule.response_type === 'text') {
          messages.push({
            type: 'text',
            text: rule.response_content
          });
        } else if (rule.response_type === 'image' && rule.response_content) {
          messages.push({
            type: 'image',
            originalContentUrl: rule.response_content,
            previewImageUrl: rule.response_content
          });
        }

        if (messages.length > 0) {
          await replyMessage(channel.channel_access_token, replyToken, messages);
        }
        
        // หยุดหลังจากตรงกับ rule แรก
        break;
      }
    }
  } catch (error) {
    console.error('Auto-reply error:', error);
  }
}
