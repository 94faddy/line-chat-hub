import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, Message, LineChannel, LineUser, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import { pushMessage } from '@/lib/line';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';
import mongoose from 'mongoose';

// POST - ส่งข้อความ
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const body = await request.json();
    const { conversation_id, message_type, content, media_url, package_id, sticker_id } = body;

    if (!conversation_id || !message_type) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ดึงข้อมูลการสนทนา
    const conversation = await Conversation.findById(conversation_id)
      .populate('channel_id')
      .populate('line_user_id');

    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const channel = conversation.channel_id as any;
    const lineUser = conversation.line_user_id as any;

    // ตรวจสอบสิทธิ์
    const isOwner = channel.user_id.equals(userId);
    let hasAccess = isOwner;

    if (!hasAccess) {
      const adminPermission = await AdminPermission.findOne({
        admin_id: userId,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { owner_id: channel.user_id, channel_id: null },
        ],
      });
      hasAccess = !!adminPermission;
    }

    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ส่งข้อความ' }, { status: 403 });
    }

    // สร้าง LINE message object
    let lineMessage: any;
    let processedMediaUrl = media_url;
    let messagePreview = '';
    
    if (message_type === 'text') {
      if (!content) {
        return NextResponse.json({ success: false, message: 'กรุณากรอกข้อความ' }, { status: 400 });
      }
      lineMessage = { type: 'text', text: content };
      messagePreview = content;
    } else if (message_type === 'image') {
      if (!media_url) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุ URL รูปภาพ' }, { status: 400 });
      }
      
      if (!media_url.startsWith('https://')) {
        return NextResponse.json({ 
          success: false, 
          message: 'URL รูปภาพต้องเป็น HTTPS เท่านั้น' 
        }, { status: 400 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      if (media_url.startsWith(baseUrl) && media_url.includes('/uploads/')) {
        processedMediaUrl = media_url.replace('/uploads/', '/api/media/');
      }

      lineMessage = {
        type: 'image',
        originalContentUrl: processedMediaUrl,
        previewImageUrl: processedMediaUrl
      };
      messagePreview = '[รูปภาพ]';
    } else if (message_type === 'video') {
      if (!media_url) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุ URL วิดีโอ' }, { status: 400 });
      }
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      if (media_url.startsWith(baseUrl) && media_url.includes('/uploads/')) {
        processedMediaUrl = media_url.replace('/uploads/', '/api/media/');
      }
      
      const previewUrl = processedMediaUrl.replace(/\.[^/.]+$/, '.jpg');
      
      lineMessage = {
        type: 'video',
        originalContentUrl: processedMediaUrl,
        previewImageUrl: previewUrl
      };
      messagePreview = '[วิดีโอ]';
    } else if (message_type === 'audio') {
      if (!media_url) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุ URL เสียง' }, { status: 400 });
      }
      
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      if (media_url.startsWith(baseUrl) && media_url.includes('/uploads/')) {
        processedMediaUrl = media_url.replace('/uploads/', '/api/media/');
      }
      
      lineMessage = {
        type: 'audio',
        originalContentUrl: processedMediaUrl,
        duration: 60000
      };
      messagePreview = '[เสียง]';
    } else if (message_type === 'sticker') {
      if (!package_id || !sticker_id) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุ package_id และ sticker_id' }, { status: 400 });
      }
      
      lineMessage = {
        type: 'sticker',
        packageId: package_id,
        stickerId: sticker_id
      };
      messagePreview = '[สติกเกอร์]';
    } else {
      return NextResponse.json({ success: false, message: 'ประเภทข้อความไม่ถูกต้อง' }, { status: 400 });
    }

    // ส่งข้อความไปยัง LINE
    try {
      console.log('📤 [LINE Push] Sending message:', JSON.stringify(lineMessage));
      await pushMessage(channel.channel_access_token, lineUser.line_user_id, lineMessage);
      console.log('✅ [LINE Push] Message sent successfully');
    } catch (lineError: any) {
      console.error('❌ [LINE Push] Error:', lineError.response?.data || lineError.message);
      
      const errorData = lineError.response?.data;
      let errorMessage = errorData?.message || lineError.message || 'Unknown error';
      
      return NextResponse.json({ 
        success: false, 
        message: `ไม่สามารถส่งข้อความได้: ${errorMessage}` 
      }, { status: 500 });
    }

    // ใช้เวลา Thailand timezone
    const thaiTime = new Date();

    // บันทึกข้อความ
    const message = new Message({
      conversation_id: conversation._id,
      channel_id: channel._id,
      line_user_id: lineUser._id,
      direction: 'outgoing',
      message_type,
      content: content || null,
      media_url: media_url || null,
      sticker_id: sticker_id || null,
      package_id: package_id || null,
      sent_by: userId,
      source_type: 'manual',
      created_at: thaiTime,
    });

    await message.save();

    // อัพเดทการสนทนา
    const preview = messagePreview || (message_type === 'text' ? content : `[${message_type}]`);
    conversation.last_message_preview = preview.substring(0, 100);
    conversation.last_message_at = thaiTime;
    await conversation.save();

    // ส่ง realtime notification
    const newMessage = {
      id: message._id,
      direction: 'outgoing',
      message_type,
      content: content || null,
      media_url: media_url || null,
      sticker_id: sticker_id || null,
      package_id: package_id || null,
      source_type: 'manual',
      created_at: thaiTime
    };

    await notifyNewMessage(channel._id.toString(), conversation._id.toString(), newMessage);

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความสำเร็จ',
      data: { id: message._id }
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}
