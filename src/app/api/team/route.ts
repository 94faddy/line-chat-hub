import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET - ดึงรายการสมาชิกในทีม
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

    const members = await query(
      `SELECT 
        ap.id,
        ap.admin_id,
        u.email as admin_email,
        u.name as admin_name,
        ap.channel_id,
        ch.channel_name,
        ap.permissions,
        ap.status,
        ap.invited_at,
        ap.accepted_at
       FROM admin_permissions ap
       LEFT JOIN users u ON ap.admin_id = u.id
       LEFT JOIN line_channels ch ON ap.channel_id = ch.id
       WHERE ap.owner_id = ?
       ORDER BY ap.created_at DESC`,
      [payload.userId]
    );

    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
