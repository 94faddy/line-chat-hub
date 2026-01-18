import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

// DELETE - ลบสมาชิกออกจากทีม
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
      'DELETE FROM admin_permissions WHERE id = ? AND owner_id = ?',
      [params.id, payload.userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อมูล' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Delete team member error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดทสิทธิ์สมาชิก
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
    const { permissions, status } = body;

    const updates: string[] = [];
    const values: any[] = [];

    if (permissions) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(permissions));
    }

    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    values.push(params.id, payload.userId);

    await query(
      `UPDATE admin_permissions SET ${updates.join(', ')} WHERE id = ? AND owner_id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'อัพเดทสำเร็จ' });
  } catch (error) {
    console.error('Update team member error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
