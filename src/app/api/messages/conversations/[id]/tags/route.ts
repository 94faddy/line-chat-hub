import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function ตรวจสอบสิทธิ์เข้าถึง conversation และได้ owner_id
async function checkConversationAccessWithOwner(conversationId: string, userId: number): Promise<{ hasAccess: boolean; ownerId: number | null }> {
  const result = await query(
    `SELECT c.id, ch.user_id as owner_id FROM conversations c
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
  
  if (Array.isArray(result) && result.length > 0) {
    return { hasAccess: true, ownerId: (result[0] as any).owner_id };
  }
  return { hasAccess: false, ownerId: null };
}

// GET - ดึง tags ของ conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // ตรวจสอบสิทธิ์การเข้าถึง
    const { hasAccess } = await checkConversationAccessWithOwner(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    const tags = await query(
      `SELECT t.* FROM tags t
       INNER JOIN conversation_tags ct ON t.id = ct.tag_id
       WHERE ct.conversation_id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    console.error('Get conversation tags error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท tags ของ conversation
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
    const { tags } = body;

    if (!Array.isArray(tags)) {
      return NextResponse.json({ success: false, message: 'tags ต้องเป็น array' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์และได้ owner_id (ใช้ tags ของ owner)
    const { hasAccess, ownerId } = await checkConversationAccessWithOwner(id, payload.userId);
    if (!hasAccess || !ownerId) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    // ลบ tags เก่าทั้งหมด
    await query(
      'DELETE FROM conversation_tags WHERE conversation_id = ?',
      [id]
    );

    // เพิ่ม tags ใหม่ (ใช้ tags ของ owner)
    if (tags.length > 0) {
      // ตรวจสอบว่า tags เป็นของ owner หรือไม่
      const validTags = await query(
        `SELECT id FROM tags WHERE id IN (${tags.map(() => '?').join(',')}) AND user_id = ?`,
        [...tags, ownerId]
      );

      if (Array.isArray(validTags) && validTags.length > 0) {
        const validTagIds = (validTags as any[]).map(t => t.id);
        
        for (const tagId of validTagIds) {
          await query(
            'INSERT INTO conversation_tags (conversation_id, tag_id) VALUES (?, ?)',
            [id, tagId]
          );
        }
      }
    }

    return NextResponse.json({ success: true, message: 'อัพเดท tags สำเร็จ' });
  } catch (error) {
    console.error('Update conversation tags error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}