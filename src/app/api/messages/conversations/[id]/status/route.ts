import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

// PUT - อัพเดทสถานะการสนทนา
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
    const { status } = body;

    const validStatuses = ['unread', 'read', 'processing', 'completed', 'spam'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์การเข้าถึง
    const conversations = await query(
      `SELECT c.id FROM conversations c
       INNER JOIN line_channels ch ON c.channel_id = ch.id
       WHERE c.id = ? AND ch.user_id = ?`,
      [params.id, payload.userId]
    );

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    await query(
      'UPDATE conversations SET status = ? WHERE id = ?',
      [status, params.id]
    );

    return NextResponse.json({ success: true, message: 'อัพเดทสถานะสำเร็จ' });
  } catch (error) {
    console.error('Update conversation status error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
