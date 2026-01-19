import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// Helper: ดึง owner IDs ที่ user มีสิทธิ์เข้าถึง
async function getAccessibleOwnerIds(userId: number): Promise<number[]> {
  // ตัวเองเป็น owner
  const ownerIds = [userId];
  
  // ดึง owner IDs จาก admin_permissions
  const permissions = await query(
    `SELECT DISTINCT owner_id FROM admin_permissions WHERE admin_id = ? AND status = 'active'`,
    [userId]
  );
  
  if (Array.isArray(permissions)) {
    permissions.forEach((p: any) => {
      if (p.owner_id && !ownerIds.includes(p.owner_id)) {
        ownerIds.push(p.owner_id);
      }
    });
  }
  
  return ownerIds;
}

// GET - List all tags (รวม owner + admin permissions)
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

    // ดึง owner IDs ที่มีสิทธิ์เข้าถึง
    const ownerIds = await getAccessibleOwnerIds(payload.userId);
    
    const placeholders = ownerIds.map(() => '?').join(',');

    const tags = await query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM conversation_tags ct WHERE ct.tag_id = t.id) as conversations_count
       FROM tags t
       WHERE t.user_id IN (${placeholders})
       ORDER BY t.name ASC`,
      ownerIds
    );

    return NextResponse.json({ success: true, data: tags });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST - Create new tag (สร้างในชื่อ owner ของตัวเอง)
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
    const { name, color, description } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุชื่อ Tag' }, { status: 400 });
    }

    // ตรวจสอบชื่อซ้ำ (ของ user นี้)
    const existing = await query(
      'SELECT id FROM tags WHERE name = ? AND user_id = ?',
      [name, payload.userId]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้ว' }, { status: 400 });
    }

    const result: any = await query(
      `INSERT INTO tags (user_id, name, color, description) VALUES (?, ?, ?, ?)`,
      [payload.userId, name, color || '#06C755', description || null]
    );

    const newTag = await query(
      `SELECT *, 0 as conversations_count FROM tags WHERE id = ?`,
      [result.insertId]
    );

    return NextResponse.json({ success: true, data: (newTag as any[])[0] });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}