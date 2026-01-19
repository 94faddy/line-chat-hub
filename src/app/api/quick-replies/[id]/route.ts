import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

// GET - ดึงข้อความตอบกลับ
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const replies = await query(
      `SELECT qr.*, lc.channel_name
       FROM quick_replies qr
       LEFT JOIN line_channels lc ON qr.channel_id = lc.id
       WHERE qr.id = ? AND qr.user_id = ?`,
      [params.id, payload.userId]
    );

    if (!Array.isArray(replies) || replies.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: replies[0] });
  } catch (error) {
    console.error('Get quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดทข้อความตอบกลับ
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { title, shortcut, message_type, content, flex_content, media_url, channel_id, is_active } = body;

    // ตรวจสอบ ownership
    const existing = await query(
      'SELECT id FROM quick_replies WHERE id = ? AND user_id = ?',
      [params.id, payload.userId]
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    // อัพเดทเฉพาะฟิลด์ที่ส่งมา
    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title);
    }
    if (shortcut !== undefined) {
      updates.push('shortcut = ?');
      values.push(shortcut);
    }
    if (message_type !== undefined) {
      updates.push('message_type = ?');
      values.push(message_type);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(content);
    }
    if (flex_content !== undefined) {
      updates.push('flex_content = ?');
      values.push(flex_content ? JSON.stringify(flex_content) : null);
    }
    if (media_url !== undefined) {
      updates.push('media_url = ?');
      values.push(media_url);
    }
    if (channel_id !== undefined) {
      updates.push('channel_id = ?');
      values.push(channel_id);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    values.push(params.id, payload.userId);

    await query(
      `UPDATE quick_replies SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'อัพเดทสำเร็จ' });
  } catch (error) {
    console.error('Update quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบข้อความตอบกลับ
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const result: any = await query(
      'DELETE FROM quick_replies WHERE id = ? AND user_id = ?',
      [params.id, payload.userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Delete quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - เพิ่ม use count
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    await query(
      'UPDATE quick_replies SET use_count = use_count + 1 WHERE id = ? AND user_id = ?',
      [params.id, payload.userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update use count error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
