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
    const { conversation_id, message_type, content, media_url, package_id, sticker_id, flex_content, alt_text } = body;

    if (!conversation_id || !message_type) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

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
    const userId = new mongoose.Types.ObjectId(payload.userId);
    const isOwner = channel.user_id.equals(userId);
    
    let hasPermission = isOwner;
    if (!isOwner) {
      // ตรวจสอบ admin permissions
      const adminPerm = await AdminPermission.findOne({
        admin_id: userId,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { channel_id: null, owner_id: channel.user_id }
        ]
      });
      hasPermission = !!adminPerm;
    }

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
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
      
      // แปลง relative URL เป็น full URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      let fullMediaUrl = media_url;
      
      if (media_url.startsWith('/uploads/') || media_url.startsWith('/api/media/')) {
        fullMediaUrl = `${baseUrl}${media_url}`;
      }
      
      if (!fullMediaUrl.startsWith('https://')) {
        return NextResponse.json({ 
          success: false, 
          message: 'URL รูปภาพต้องเป็น HTTPS เท่านั้น' 
        }, { status: 400 });
      }

      // แปลง /uploads/ เป็น /api/media/ สำหรับ LINE
      if (fullMediaUrl.includes('/uploads/')) {
        processedMediaUrl = fullMediaUrl.replace('/uploads/', '/api/media/');
      } else {
        processedMediaUrl = fullMediaUrl;
      }

      console.log('📸 [Send Image] Original URL:', media_url);
      console.log('📸 [Send Image] Processed URL for LINE:', processedMediaUrl);
      
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
      
      // แปลง relative URL เป็น full URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      let fullMediaUrl = media_url;
      
      if (media_url.startsWith('/uploads/') || media_url.startsWith('/api/media/')) {
        fullMediaUrl = `${baseUrl}${media_url}`;
      }
      
      if (fullMediaUrl.includes('/uploads/')) {
        processedMediaUrl = fullMediaUrl.replace('/uploads/', '/api/media/');
      } else {
        processedMediaUrl = fullMediaUrl;
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
      
      // แปลง relative URL เป็น full URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      let fullMediaUrl = media_url;
      
      if (media_url.startsWith('/uploads/') || media_url.startsWith('/api/media/')) {
        fullMediaUrl = `${baseUrl}${media_url}`;
      }
      
      if (fullMediaUrl.includes('/uploads/')) {
        processedMediaUrl = fullMediaUrl.replace('/uploads/', '/api/media/');
      } else {
        processedMediaUrl = fullMediaUrl;
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
      
      console.log('🎉 [Send Sticker] Package:', package_id, 'Sticker:', sticker_id);
      
      lineMessage = {
        type: 'sticker',
        packageId: package_id,
        stickerId: sticker_id
      };
      messagePreview = '[สติกเกอร์]';
    } else if (message_type === 'flex') {
      if (!flex_content) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุ Flex Message content' }, { status: 400 });
      }
      
      console.log('📦 [Send Flex] Sending flex message');
      
      // flex_content อาจเป็น string หรือ object
      let flexData = flex_content;
      if (typeof flex_content === 'string') {
        try {
          flexData = JSON.parse(flex_content);
        } catch (e) {
          return NextResponse.json({ success: false, message: 'Flex Message JSON ไม่ถูกต้อง' }, { status: 400 });
        }
      }
      
      // รองรับทั้งรูปแบบจาก Simulator (bubble/carousel) และรูปแบบเต็ม (flex)
      if (flexData.type === 'bubble' || flexData.type === 'carousel') {
        lineMessage = {
          type: 'flex',
          altText: alt_text || content || 'Flex Message',
          contents: flexData
        };
      } else if (flexData.type === 'flex') {
        lineMessage = {
          type: 'flex',
          altText: flexData.altText || alt_text || content || 'Flex Message',
          contents: flexData.contents
        };
      } else {
        return NextResponse.json({ success: false, message: 'Flex Message format ไม่ถูกต้อง' }, { status: 400 });
      }
      
      messagePreview = alt_text || content || '[Flex Message]';
    } else {
      return NextResponse.json({ success: false, message: 'ประเภทข้อความไม่ถูกต้อง' }, { status: 400 });
    }

    // ส่งข้อความไปยัง LINE
    try {
      console.log('📤 [LINE Push] Sending message:', JSON.stringify(lineMessage));
      await pushMessage(channel.channel_access_token, lineUser.line_user_id, lineMessage);
      console.log('✅ [LINE Push] Message sent successfully');
    } catch (lineError: any) {
      console.error('❌ [LINE Push] Error:', lineError.response?.data || lineError.message || lineError);
      
      const errorData = lineError.response?.data;
      let errorMessage = 'Unknown error';
      
      if (errorData) {
        errorMessage = errorData.message || JSON.stringify(errorData);
      } else {
        errorMessage = lineError.message;
      }
      
      return NextResponse.json({ 
        success: false, 
        message: `ไม่สามารถส่งข้อความได้: ${errorMessage}` 
      }, { status: 500 });
    }

    const thaiTime = new Date();

    // บันทึกข้อความลงฐานข้อมูล
    const newMessage = new Message({
      conversation_id: conversation._id,
      channel_id: channel._id,
      line_user_id: lineUser._id,
      direction: 'outgoing',
      message_type,
      content: content || null,
      media_url: media_url || null,
      flex_content: message_type === 'flex' ? (typeof flex_content === 'string' ? flex_content : JSON.stringify(flex_content)) : null,
      sticker_id: sticker_id || null,
      package_id: package_id || null,
      sent_by: userId,
      source_type: 'manual',
      created_at: thaiTime
    });

    await newMessage.save();

    // อัพเดทการสนทนา - ✅ Mark as read เมื่อมีคนตอบ
    const preview = messagePreview || (message_type === 'text' ? content : `[${message_type}]`);
    await Conversation.findByIdAndUpdate(conversation._id, {
      last_message_preview: preview.substring(0, 100),
      last_message_at: thaiTime,
      status: 'read',      // ✅ Mark as read
      unread_count: 0      // ✅ Reset unread count
    });

    // ✅ ดึงข้อมูล user ที่ส่งข้อความ
    const User = mongoose.models.User;
    const senderUser = await User.findById(userId).select('name avatar').lean() as { name?: string; avatar?: string } | null;

    // ส่ง realtime notification
    const messageData = {
      id: newMessage._id,
      direction: 'outgoing',
      message_type,
      content: content || null,
      media_url: media_url || null,
      flex_content: message_type === 'flex' ? (typeof flex_content === 'string' ? flex_content : JSON.stringify(flex_content)) : null,
      sticker_id: sticker_id || null,
      package_id: package_id || null,
      source_type: 'manual',
      // ✅ เพิ่มข้อมูลคนส่ง
      sent_by: senderUser ? {
        id: userId,
        name: senderUser.name,
        avatar: senderUser.avatar
      } : null,
      created_at: thaiTime
    };

    await notifyNewMessage(channel._id.toString(), conversation._id.toString(), messageData);

    // ✅ Notify conversation update (status changed to read)
    await notifyConversationUpdate(channel._id.toString(), {
      id: conversation._id,
      status: 'read',
      last_message_preview: preview.substring(0, 100),
      last_message_at: thaiTime,
      unread_count: 0,
    });

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความสำเร็จ',
      data: { id: newMessage._id }
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}