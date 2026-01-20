import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, LineChannel, LineUser, Conversation, Message } from '@/models';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';

// Helper: ตรวจสอบ Bot API Token
async function verifyBotToken(authHeader: string | null): Promise<{ valid: boolean; userId: string | null }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, userId: null };
  }
  
  const token = authHeader.substring(7);
  
  const user = await User.findOne({ bot_api_token: token }).select('_id').lean();
  
  if (!user) {
    return { valid: false, userId: null };
  }
  
  return { valid: true, userId: (user as any)._id.toString() };
}

// Helper: ส่งข้อความ LINE
async function sendLineMessage(channelAccessToken: string, userId: string, message: any): Promise<boolean> {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [message],
      }),
    });
    
    return response.ok;
  } catch (error) {
    console.error('Send LINE message error:', error);
    return false;
  }
}

// POST - ส่งข้อความผ่าน Bot API
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    // ตรวจสอบ Bot Token
    const authHeader = request.headers.get('authorization');
    const { valid, userId } = await verifyBotToken(authHeader);
    
    if (!valid || !userId) {
      return NextResponse.json({ success: false, message: 'Invalid API Token' }, { status: 401 });
    }

    const body = await request.json();
    const { channel_id, line_user_id, message_type = 'text', content, flex_content, media_url } = body;

    // Validation
    if (!channel_id || !line_user_id || !content) {
      return NextResponse.json({ 
        success: false, 
        message: 'กรุณาระบุ channel_id, line_user_id และ content' 
      }, { status: 400 });
    }

    // ตรวจสอบว่าเป็น owner ของ channel หรือไม่
    const channel = await LineChannel.findOne({
      _id: channel_id,
      user_id: userId,
    });

    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือไม่มีสิทธิ์' }, { status: 404 });
    }

    // ตรวจสอบ LINE user
    let lineUser = await LineUser.findOne({
      channel_id: channel_id,
      line_user_id: line_user_id,
    });

    // ถ้าไม่มี LINE user ให้สร้างใหม่
    if (!lineUser) {
      lineUser = new LineUser({
        channel_id,
        line_user_id,
        display_name: 'Unknown User',
      });
      await lineUser.save();
    }

    // หา หรือ สร้าง conversation
    let conversation = await Conversation.findOne({
      channel_id,
      line_user_id: lineUser._id,
    });

    if (!conversation) {
      conversation = new Conversation({
        channel_id,
        line_user_id: lineUser._id,
        status: 'read',
        unread_count: 0,
      });
      await conversation.save();
    }

    // สร้าง LINE message object
    let lineMessage: any;
    
    switch (message_type) {
      case 'text':
        lineMessage = { type: 'text', text: content };
        break;
      case 'image':
        lineMessage = {
          type: 'image',
          originalContentUrl: media_url,
          previewImageUrl: media_url,
        };
        break;
      case 'video':
        lineMessage = {
          type: 'video',
          originalContentUrl: media_url,
          previewImageUrl: media_url?.replace(/\.[^/.]+$/, '.jpg') || media_url,
        };
        break;
      case 'flex':
        lineMessage = {
          type: 'flex',
          altText: content,
          contents: typeof flex_content === 'string' ? JSON.parse(flex_content) : flex_content,
        };
        break;
      case 'sticker':
        const [packageId, stickerId] = content.split(':');
        lineMessage = {
          type: 'sticker',
          packageId: packageId,
          stickerId: stickerId,
        };
        break;
      default:
        lineMessage = { type: 'text', text: content };
    }

    // ส่งข้อความ LINE
    const sent = await sendLineMessage(channel.channel_access_token, line_user_id, lineMessage);

    if (!sent) {
      return NextResponse.json({ success: false, message: 'ส่งข้อความไปยัง LINE ไม่สำเร็จ' }, { status: 500 });
    }

    // บันทึก message
    const message = new Message({
      conversation_id: conversation._id,
      channel_id,
      line_user_id: lineUser._id,
      direction: 'outgoing',
      message_type,
      content,
      flex_content: flex_content || null,
      media_url: media_url || null,
      is_read: true,
      sent_by: userId,
      source: 'bot_api',
    });

    await message.save();

    // อัพเดท conversation
    conversation.last_message_at = new Date();
    await conversation.save();

    // แจ้งเตือน realtime
    try {
      notifyNewMessage(channel_id, message.toObject());
      notifyConversationUpdate(channel_id, {
        conversation_id: conversation._id.toString(),
        last_message_at: conversation.last_message_at,
      });
    } catch (e) {
      console.error('Notify error:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความสำเร็จ',
      data: {
        message_id: message._id,
        conversation_id: conversation._id,
      },
    });
  } catch (error) {
    console.error('Bot send error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
