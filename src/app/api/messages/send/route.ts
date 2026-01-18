import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { pushMessage } from '@/lib/line';

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
    const { conversation_id, message_type, content, media_url } = body;

    if (!conversation_id || !message_type) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    // ดึงข้อมูลการสนทนา
    const conversations = await query(
      `SELECT 
        c.id, c.channel_id, c.line_user_id,
        ch.channel_access_token,
        lu.line_user_id as target_user_id
       FROM conversations c
       INNER JOIN line_channels ch ON c.channel_id = ch.id
       INNER JOIN line_users lu ON c.line_user_id = lu.id
       WHERE c.id = ? AND ch.user_id = ?`,
      [conversation_id, payload.userId]
    );

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const conv = conversations[0] as any;

    // สร้าง LINE message object
    let lineMessage: any;
    if (message_type === 'text') {
      if (!content) {
        return NextResponse.json({ success: false, message: 'กรุณากรอกข้อความ' }, { status: 400 });
      }
      lineMessage = { type: 'text', text: content };
    } else if (message_type === 'image') {
      if (!media_url) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุ URL รูปภาพ' }, { status: 400 });
      }
      lineMessage = {
        type: 'image',
        originalContentUrl: media_url,
        previewImageUrl: media_url
      };
    } else {
      return NextResponse.json({ success: false, message: 'ประเภทข้อความไม่ถูกต้อง' }, { status: 400 });
    }

    // ส่งข้อความไปยัง LINE
    try {
      await pushMessage(conv.channel_access_token, conv.target_user_id, lineMessage);
    } catch (lineError: any) {
      console.error('LINE push error:', lineError);
      return NextResponse.json({ 
        success: false, 
        message: `ไม่สามารถส่งข้อความได้: ${lineError.message || 'Unknown error'}` 
      }, { status: 500 });
    }

    // บันทึกข้อความลงฐานข้อมูล
    const result: any = await query(
      `INSERT INTO messages 
       (conversation_id, channel_id, line_user_id, direction, message_type, content, media_url, sent_by) 
       VALUES (?, ?, ?, 'outgoing', ?, ?, ?, ?)`,
      [conversation_id, conv.channel_id, conv.line_user_id, message_type, content || null, media_url || null, payload.userId]
    );

    // อัพเดทการสนทนา
    const preview = message_type === 'text' ? content : `[${message_type}]`;
    await query(
      `UPDATE conversations SET last_message_preview = ?, last_message_at = NOW() WHERE id = ?`,
      [preview.substring(0, 100), conversation_id]
    );

    return NextResponse.json({
      success: true,
      message: 'ส่งข้อความสำเร็จ',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
