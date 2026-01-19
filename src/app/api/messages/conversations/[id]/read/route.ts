import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function ตรวจสอบสิทธิ์เข้าถึง conversation
async function checkConversationAccess(conversationId: string, userId: number): Promise<boolean> {
  const result = await query(
    `SELECT c.id FROM conversations c
     INNER JOIN line_channels ch ON c.channel_id = ch.id
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
    [conversationId, userId, userId, userId]
  );
  return Array.isArray(result) && result.length > 0;
}

// POST - Mark conversation as read
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    // ตรวจสอบสิทธิ์การเข้าถึง (รวม admin permissions)
    const hasAccess = await checkConversationAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    // อัพเดทสถานะและ unread count
    await query(
      `UPDATE conversations 
       SET status = CASE WHEN status = 'unread' THEN 'read' ELSE status END, 
           unread_count = 0 
       WHERE id = ?`,
      [id]
    );

    // Mark all messages as read
    await query(
      'UPDATE messages SET is_read = 1, read_at = NOW() WHERE conversation_id = ? AND is_read = 0',
      [id]
    );

    return NextResponse.json({ success: true, message: 'อ่านข้อความแล้ว' });
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}