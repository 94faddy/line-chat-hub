import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, generateVerificationToken } from '@/lib/auth';
import { sendAdminInviteEmail } from '@/lib/email';

// POST - เชิญสมาชิกใหม่
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
    const { email, channel_id, permissions } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกอีเมล' }, { status: 400 });
    }

    // ค้นหาหรือสร้างผู้ใช้
    let users = await query('SELECT id, email, name FROM users WHERE email = ?', [email]);
    let adminId: number;

    if (Array.isArray(users) && users.length > 0) {
      adminId = (users[0] as any).id;
    } else {
      // สร้างผู้ใช้ใหม่แบบ pending
      const result: any = await query(
        `INSERT INTO users (email, password, name, status) 
         VALUES (?, '', ?, 'pending')`,
        [email, email.split('@')[0]]
      );
      adminId = result.insertId;
    }

    // ตรวจสอบว่าเชิญซ้ำหรือไม่
    const existing = await query(
      `SELECT id FROM admin_permissions 
       WHERE owner_id = ? AND admin_id = ? AND (channel_id = ? OR (channel_id IS NULL AND ? IS NULL))`,
      [payload.userId, adminId, channel_id || null, channel_id || null]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ success: false, message: 'อีเมลนี้ได้รับเชิญแล้ว' }, { status: 400 });
    }

    // สร้าง invite token
    const inviteToken = generateVerificationToken();

    // สร้าง permission พร้อม invite token
    await query(
      `INSERT INTO admin_permissions (owner_id, admin_id, channel_id, permissions, status, invite_token)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [payload.userId, adminId, channel_id || null, JSON.stringify(permissions), inviteToken]
    );

    // ดึงข้อมูลเจ้าของ
    const owners = await query('SELECT name, email FROM users WHERE id = ?', [payload.userId]);
    const owner = owners && Array.isArray(owners) ? owners[0] as any : null;

    // ส่งอีเมลเชิญ
    try {
      await sendAdminInviteEmail(email, owner?.name || 'ผู้ใช้', inviteToken);
    } catch (emailError) {
      console.error('Send invite email error:', emailError);
      // ไม่ return error เพราะ permission สร้างสำเร็จแล้ว
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งคำเชิญสำเร็จ'
    });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
