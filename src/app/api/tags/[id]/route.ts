import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: ตรวจสอบสิทธิ์เข้าถึง tag
async function checkTagAccess(tagId: string, userId: number): Promise<{ hasAccess: boolean; isOwner: boolean }> {
  // เช็คว่าเป็น owner ของ tag
  const ownerCheck = await query(
    'SELECT id FROM tags WHERE id = ? AND user_id = ?',
    [tagId, userId]
  );
  
  if (Array.isArray(ownerCheck) && ownerCheck.length > 0) {
    return { hasAccess: true, isOwner: true };
  }
  
  // เช็คว่าเป็น admin ที่มีสิทธิ์เข้าถึง owner ของ tag นี้
  const adminCheck = await query(
    `SELECT t.id FROM tags t
     INNER JOIN admin_permissions ap ON ap.owner_id = t.user_id
     WHERE t.id = ? AND ap.admin_id = ? AND ap.status = 'active'`,
    [tagId, userId]
  );
  
  if (Array.isArray(adminCheck) && adminCheck.length > 0) {
    return { hasAccess: true, isOwner: false };
  }
  
  return { hasAccess: false, isOwner: false };
}

// GET - Get single tag
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

    const { id } = await params;

    // ตรวจสอบสิทธิ์
    const { hasAccess } = await checkTagAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Tag นี้' }, { status: 403 });
    }

    const tags = await query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM conversation_tags ct WHERE ct.tag_id = t.id) as conversations_count
       FROM tags t
       WHERE t.id = ?`,
      [id]
    );

    if (!Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: tags[0] });
  } catch (error: any) {
    console.error('Error fetching tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT - Update tag (เฉพาะ owner)
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

    const { id } = await params;
    const body = await request.json();

    // ตรวจสอบว่าเป็น owner
    const { isOwner } = await checkTagAccess(id, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่แก้ไขได้' }, { status: 403 });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) {
      // ตรวจสอบชื่อซ้ำ
      const existing = await query(
        'SELECT id FROM tags WHERE name = ? AND id != ? AND user_id = ?',
        [body.name, id, payload.userId]
      );

      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้ว' }, { status: 400 });
      }

      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      values.push(body.color);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    values.push(id);

    await query(
      `UPDATE tags SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const updated = await query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM conversation_tags ct WHERE ct.tag_id = t.id) as conversations_count
       FROM tags t
       WHERE t.id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, data: (updated as any[])[0] });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE - Delete tag (เฉพาะ owner)
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

    const { id } = await params;

    // ตรวจสอบว่าเป็น owner
    const { isOwner } = await checkTagAccess(id, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่ลบได้' }, { status: 403 });
    }

    // ลบ tag จาก conversations ก่อน
    await query('DELETE FROM conversation_tags WHERE tag_id = ?', [id]);

    // ลบ tag
    await query('DELETE FROM tags WHERE id = ? AND user_id = ?', [id, payload.userId]);

    return NextResponse.json({ success: true, message: 'ลบ Tag สำเร็จ' });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}