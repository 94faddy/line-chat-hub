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

// PUT - อัพเดทสถานะการสนทนา
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { status } = body;

    const validStatuses = ['unread', 'read', 'processing', 'completed', 'spam'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์การเข้าถึง (รวม admin permissions)
    const hasAccess = await checkConversationAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    await query(
      'UPDATE conversations SET status = ? WHERE id = ?',
      [status, id]
    );

    return NextResponse.json({ success: true, message: 'อัพเดทสถานะสำเร็จ' });
  } catch (error) {
    console.error('Update conversation status error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}