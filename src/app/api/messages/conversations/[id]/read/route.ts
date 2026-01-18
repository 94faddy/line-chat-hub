import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

// POST - Mark conversation as read
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

    // อัพเดทสถานะและ unread count
    await query(
      `UPDATE conversations 
       SET status = CASE WHEN status = 'unread' THEN 'read' ELSE status END, 
           unread_count = 0 
       WHERE id = ?`,
      [params.id]
    );

    // Mark all messages as read
    await query(
      'UPDATE messages SET is_read = 1, read_at = NOW() WHERE conversation_id = ? AND is_read = 0',
      [params.id]
    );

    return NextResponse.json({ success: true, message: 'อ่านข้อความแล้ว' });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
