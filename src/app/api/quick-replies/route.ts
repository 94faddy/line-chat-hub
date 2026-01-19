import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET - ดึงรายการข้อความตอบกลับ
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channel_id');

    let sql = `
      SELECT qr.*, lc.channel_name
      FROM quick_replies qr
      LEFT JOIN line_channels lc ON qr.channel_id = lc.id
      WHERE qr.user_id = ? AND qr.is_active = 1
    `;
    const params: any[] = [payload.userId];

    // ดึงทั้งที่เป็น global (channel_id = null) และของ channel ที่ระบุ
    if (channelId) {
      sql += ' AND (qr.channel_id IS NULL OR qr.channel_id = ?)';
      params.push(channelId);
    }

    sql += ' ORDER BY qr.use_count DESC, qr.created_at DESC';

    const replies = await query(sql, params);

    return NextResponse.json({ success: true, data: replies });
  } catch (error) {
    console.error('Get quick replies error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้างข้อความตอบกลับใหม่
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
    const { title, shortcut, message_type, content, flex_content, media_url, channel_id } = body;

    if (!title || !content) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกชื่อและข้อความ' }, { status: 400 });
    }

    // ถ้าระบุ channel_id ให้ตรวจสอบว่าเป็นของ user หรือไม่
    if (channel_id) {
      const channels = await query(
        'SELECT id FROM line_channels WHERE id = ? AND user_id = ?',
        [channel_id, payload.userId]
      );
      if (!Array.isArray(channels) || channels.length === 0) {
        return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
      }
    }

    const result: any = await query(
      `INSERT INTO quick_replies (user_id, channel_id, title, shortcut, message_type, content, flex_content, media_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.userId,
        channel_id || null,
        title,
        shortcut || null,
        message_type || 'text',
        content,
        flex_content ? JSON.stringify(flex_content) : null,
        media_url || null
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'สร้างข้อความตอบกลับสำเร็จ',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Create quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
