import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { pushMessage } from '@/lib/line';
import { notifyNewMessage, notifyConversationUpdate } from '@/lib/notifier';

// POST - ส่งข้อความ
export async function POST(request: NextRequest) {
  try {
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

    // ดึงข้อมูลการสนทนา (รองรับ owner + admin permissions)
    const conversations = await query(
      `SELECT 
        c.id, c.channel_id, c.line_user_id,
        ch.channel_access_token,
        lu.line_user_id as target_user_id
       FROM conversations c
       INNER JOIN line_channels ch ON c.channel_id = ch.id
       INNER JOIN line_users lu ON c.line_user_id = lu.id
       WHERE c.id = ? AND (
         ch.user_id = ?
         OR ch.id IN (
           SELECT ap.channel_id FROM admin_permissions ap 
           WHERE ap.admin_id = ? AND ap.status = 'active' AND ap.channel_id IS NOT NULL
         )
         OR ch.user_id IN (
           SELECT ap.owner_id FROM admin_permissions ap 
           WHERE ap.admin_id = ? AND ap.status = 'active' AND ap.channel_id IS NULL
         )
       )`,
      [conversation_id, payload.userId, payload.userId, payload.userId]
    );

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const conv = conversations[0] as any;

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
      
      // ตรวจสอบว่า URL เป็น HTTPS
      if (!media_url.startsWith('https://')) {
        return NextResponse.json({ 
          success: false, 
          message: 'URL รูปภาพต้องเป็น HTTPS เท่านั้น' 
        }, { status: 400 });
      }

      // สำหรับ URL ที่ใช้ /uploads/ ให้แปลงเป็น /api/media/
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      if (media_url.startsWith(baseUrl) && media_url.includes('/uploads/')) {
        processedMediaUrl = media_url.replace('/uploads/', '/api/media/');
      }

      console.log('📸 [Send Image] Original URL:', media_url);
      console.log('📸 [Send Image] Processed URL for LINE:', processedMediaUrl);
      console.log('📸 [Send Image] Target user:', conv.target_user_id);
      
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
      // ✅ รองรับการส่ง Sticker
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
    } else {
      return NextResponse.json({ success: false, message: 'ประเภทข้อความไม่ถูกต้อง' }, { status: 400 });
    }

    // ส่งข้อความไปยัง LINE
    try {
      console.log('📤 [LINE Push] Sending message:', JSON.stringify(lineMessage));
      await pushMessage(conv.channel_access_token, conv.target_user_id, lineMessage);
      console.log('✅ [LINE Push] Message sent successfully');
    } catch (lineError: any) {
      console.error('❌ [LINE Push] Error:', lineError.response?.data || lineError.message || lineError);
      
      const errorData = lineError.response?.data;
      let errorMessage = 'Unknown error';
      
      if (errorData) {
        errorMessage = errorData.message || JSON.stringify(errorData);
        console.error('LINE API Error Details:', errorData);
      } else {
        errorMessage = lineError.message;
      }
      
      return NextResponse.json({ 
        success: false, 
        message: `ไม่สามารถส่งข้อความได้: ${errorMessage}` 
      }, { status: 500 });
    }

    // ใช้เวลา Thailand timezone
    const thaiTime = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T');

    // บันทึกข้อความลงฐานข้อมูล
    const result: any = await query(
      `INSERT INTO messages 
       (conversation_id, channel_id, line_user_id, direction, message_type, content, media_url, sticker_id, package_id, sent_by, source_type, created_at) 
       VALUES (?, ?, ?, 'outgoing', ?, ?, ?, ?, ?, ?, 'manual', ?)`,
      [
        conversation_id, 
        conv.channel_id, 
        conv.line_user_id, 
        message_type, 
        content || null, 
        media_url || null, 
        sticker_id || null,
        package_id || null,
        payload.userId, 
        thaiTime
      ]
    );

    // อัพเดทการสนทนา
    const preview = messagePreview || (message_type === 'text' ? content : `[${message_type}]`);
    await query(
      `UPDATE conversations SET last_message_preview = ?, last_message_at = ? WHERE id = ?`,
      [preview.substring(0, 100), thaiTime, conversation_id]
    );

    // ส่ง realtime notification
    const newMessage = {
      id: result.insertId,
      direction: 'outgoing',
      message_type,
      content: content || null,
      media_url: media_url || null,
      sticker_id: sticker_id || null,
      package_id: package_id || null,
      source_type: 'manual',
      created_at: thaiTime
    };

    await notifyNewMessage(conv.channel_id, conversation_id, newMessage);

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความสำเร็จ',
      data: { id: result.insertId }
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}