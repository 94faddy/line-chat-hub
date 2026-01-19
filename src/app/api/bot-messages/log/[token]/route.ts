import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';

interface RouteParams {
  params: { token: string };
}

// POST - รับข้อความจาก Bot Server โดยใช้ User Token
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token is required' }, { status: 400 });
    }

    // ค้นหา user จาก token
    const users = await query(
      `SELECT id FROM users WHERE bot_api_token = ?`,
      [token]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 401 });
    }

    const user = users[0] as any;
    console.log(`📥 [Bot API] Request from user ID: ${user.id} (token: ${token.substring(0, 8)}...)`);

    // Parse JSON body with error handling
    let body;
    try {
      const text = await request.text();
      console.log('📥 [Bot API] Received text:', text.substring(0, 200));
      
      if (!text || text.trim() === '') {
        return NextResponse.json({ success: false, message: 'Empty request body' }, { status: 400 });
      }
      body = JSON.parse(text);
      console.log('📥 [Bot API] Parsed body:', JSON.stringify(body).substring(0, 200));
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return NextResponse.json({ success: false, message: 'Invalid JSON format' }, { status: 400 });
    }

    const { 
      channel_id,
      line_user_id,
      message_type,
      content,
      media_url,
      flex_content,
      sticker_id,
      package_id,
      alt_text
    } = body;

    if (!line_user_id || !message_type) {
      return NextResponse.json({ 
        success: false, 
        message: 'กรุณาระบุ line_user_id และ message_type' 
      }, { status: 400 });
    }

    // ค้นหา channel ของ user นี้
    let channel: any = null;
    
    if (channel_id) {
      // ค้นหาจาก channel_id ที่ระบุ และต้องเป็นของ user นี้
      const channels = await query(
        `SELECT * FROM line_channels WHERE (id = ? OR channel_id = ?) AND user_id = ? LIMIT 1`,
        [channel_id, channel_id, user.id]
      );
      if (Array.isArray(channels) && channels.length > 0) {
        channel = channels[0];
      }
    }

    if (!channel) {
      // ถ้าไม่ระบุ channel_id ให้หาจาก line_user_id (ต้องเป็น channel ของ user นี้)
      const usersData = await query(
        `SELECT lu.*, lc.id as channel_id, lc.channel_name 
         FROM line_users lu
         INNER JOIN line_channels lc ON lu.channel_id = lc.id
         WHERE lu.line_user_id = ? AND lc.user_id = ?
         LIMIT 1`,
        [line_user_id, user.id]
      );
      
      if (Array.isArray(usersData) && usersData.length > 0) {
        const userData = usersData[0] as any;
        channel = { id: userData.channel_id };
      }
    }

    if (!channel) {
      return NextResponse.json({ 
        success: false, 
        message: 'ไม่พบ Channel หรือ Channel ไม่ใช่ของ user นี้' 
      }, { status: 404 });
    }

    // ค้นหา LINE User
    const lineUsers = await query(
      `SELECT * FROM line_users WHERE channel_id = ? AND line_user_id = ?`,
      [channel.id, line_user_id]
    );

    if (!Array.isArray(lineUsers) || lineUsers.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'ไม่พบ LINE User' 
      }, { status: 404 });
    }

    const lineUser = lineUsers[0] as any;

    // ค้นหา Conversation
    const conversations = await query(
      `SELECT * FROM conversations WHERE channel_id = ? AND line_user_id = ?`,
      [channel.id, lineUser.id]
    );

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'ไม่พบ Conversation' 
      }, { status: 404 });
    }

    const conversation = conversations[0] as any;

    // เตรียมข้อมูลข้อความ
    let msgContent = content || null;
    let msgFlexContent = null;
    
    if (message_type === 'flex' || message_type === 'template') {
      if (flex_content) {
        if (typeof flex_content === 'object') {
          msgFlexContent = JSON.stringify(flex_content);
        } else if (typeof flex_content === 'string') {
          try {
            JSON.parse(flex_content);
            msgFlexContent = flex_content;
          } catch {
            msgFlexContent = JSON.stringify(flex_content);
          }
        }
      }
      msgContent = alt_text || content || `[${message_type === 'flex' ? 'Flex Message' : 'Template'}]`;
      console.log('📥 [Bot API] Flex content saved:', msgFlexContent?.substring(0, 100));
    }

    // ใช้เวลา Thailand timezone
    const thaiTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T');

    // บันทึกข้อความ
    const result: any = await query(
      `INSERT INTO messages 
       (conversation_id, channel_id, line_user_id, direction, message_type, 
        content, media_url, flex_content, sticker_id, package_id, source_type, created_at)
       VALUES (?, ?, ?, 'outgoing', ?, ?, ?, ?, ?, ?, 'bot_reply', ?)`,
      [
        conversation.id,
        channel.id,
        lineUser.id,
        message_type,
        msgContent,
        media_url || null,
        msgFlexContent,
        sticker_id || null,
        package_id || null,
        thaiTime
      ]
    );

    // อัพเดท Conversation
    let preview = '';
    switch (message_type) {
      case 'text':
        preview = content || '';
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
      case 'flex':
        preview = alt_text || '[Flex Message]';
        break;
      case 'template':
        preview = alt_text || '[Template]';
        break;
      default:
        preview = `[${message_type}]`;
    }

    await query(
      `UPDATE conversations SET last_message_preview = ?, last_message_at = ? WHERE id = ?`,
      [preview.substring(0, 100), thaiTime, conversation.id]
    );

    // ส่ง Realtime Notification
    const newMessage = {
      id: result.insertId,
      direction: 'outgoing',
      message_type,
      content: msgContent,
      media_url: media_url || null,
      flex_content: msgFlexContent,
      source_type: 'bot_reply',
      created_at: thaiTime
    };

    await notifyNewMessage(channel.id, conversation.id, newMessage);

    await notifyConversationUpdate(channel.id, {
      id: conversation.id,
      last_message_preview: preview,
      last_message_at: thaiTime
    });

    console.log(`✅ [Bot API] Message saved for user ID ${user.id}, conversation ${conversation.id}`);

    return NextResponse.json({
      success: true,
      message: 'บันทึกข้อความสำเร็จ',
      data: { 
        message_id: result.insertId,
        conversation_id: conversation.id
      }
    });

  } catch (error: any) {
    console.error('Bot message log error:', error.message || error);
    console.error('Stack:', error.stack);
    return NextResponse.json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
}