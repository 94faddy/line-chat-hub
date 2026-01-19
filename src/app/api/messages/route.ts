import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

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

// GET - ดึงข้อความทั้งหมดในการสนทนา
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
    const conversationId = searchParams.get('conversation_id');

    if (!conversationId) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุ conversation_id' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์การเข้าถึง (รวม admin permissions)
    const hasAccess = await checkConversationAccess(conversationId, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    const messages = await query(
      `SELECT 
        id, direction, message_type, content, media_url, 
        sticker_id, package_id, flex_content, source_type, is_read, created_at
       FROM messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC`,
      [conversationId]
    );

    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}