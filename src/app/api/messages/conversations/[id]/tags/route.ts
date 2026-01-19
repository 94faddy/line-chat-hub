import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

// GET - ดึง tags ของ conversation
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

    const tags = await query(
      `SELECT t.* FROM tags t
       INNER JOIN conversation_tags ct ON t.id = ct.tag_id
       INNER JOIN conversations c ON ct.conversation_id = c.id
       INNER JOIN line_channels ch ON c.channel_id = ch.id
       WHERE ct.conversation_id = ? AND ch.user_id = ?`,
      [params.id, payload.userId]
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

    // ตรวจสอบ ownership ของ conversation
    const conversations = await query(
      `SELECT c.id FROM conversations c
       INNER JOIN line_channels ch ON c.channel_id = ch.id
       WHERE c.id = ? AND ch.user_id = ?`,
      [params.id, payload.userId]
    );

    if (!Array.isArray(conversations) || conversations.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    // ลบ tags เก่าทั้งหมด
    await query(
      'DELETE FROM conversation_tags WHERE conversation_id = ?',
      [params.id]
    );

    // เพิ่ม tags ใหม่
    if (tags.length > 0) {
      // ตรวจสอบว่า tags เป็นของ user หรือไม่
      const validTags = await query(
        `SELECT id FROM tags WHERE id IN (${tags.map(() => '?').join(',')}) AND user_id = ?`,
        [...tags, payload.userId]
      );

      if (Array.isArray(validTags) && validTags.length > 0) {
        const validTagIds = (validTags as any[]).map(t => t.id);
        const values = validTagIds.map(tagId => [params.id, tagId]);
        
        for (const [convId, tagId] of values) {
          await query(
            'INSERT INTO conversation_tags (conversation_id, tag_id) VALUES (?, ?)',
            [convId, tagId]
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
