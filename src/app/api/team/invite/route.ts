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

    // สร้าง invite token
    const inviteToken = generateVerificationToken();
    
    // กำหนดวันหมดอายุ (7 วัน)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    // ถ้าไม่มี email ให้สร้าง invite link แบบ public
    if (!email) {
      // ตรวจสอบว่ามี pending invite ที่ใช้ owner_id เป็น placeholder อยู่หรือไม่
      const existingInvites = await query(
        `SELECT id FROM admin_permissions 
         WHERE owner_id = ? AND admin_id = owner_id AND status = 'pending' AND invite_token IS NOT NULL
         AND (channel_id = ? OR (channel_id IS NULL AND ? IS NULL))`,
        [payload.userId, channel_id || null, channel_id || null]
      );

      // ลบ invite เก่าที่ยังไม่มีคนรับ
      if (Array.isArray(existingInvites) && existingInvites.length > 0) {
        await query(
          `DELETE FROM admin_permissions WHERE id = ?`,
          [(existingInvites[0] as any).id]
        );
      }

      // สร้าง permission พร้อม invite token - ใช้ owner_id เป็น placeholder สำหรับ admin_id
      // เมื่อ user รับ invite จะอัพเดท admin_id เป็น user ที่รับ
      const permissionsData = { ...(permissions || { can_reply: true }), is_public_invite: true };
      
      const result: any = await query(
        `INSERT INTO admin_permissions (owner_id, admin_id, channel_id, permissions, status, invite_token, invite_expires_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
        [payload.userId, payload.userId, channel_id || null, JSON.stringify(permissionsData), inviteToken, expiresAtStr]
      );

      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite?token=${inviteToken}`;

      console.log(`🔗 Created public invite link for user ${payload.userId}`);

      return NextResponse.json({
        success: true,
        message: 'สร้างลิงก์เชิญสำเร็จ',
        data: {
          invite_url: inviteUrl,
          invite_token: inviteToken,
          expires_at: expiresAtStr,
          id: result.insertId
        }
      });
    }

    // ถ้ามี email ให้ทำแบบเดิม
    // ค้นหาหรือสร้างผู้ใช้
    let users = await query('SELECT id, email, name FROM users WHERE email = ?', [email]);
    let adminId: number;

    if (Array.isArray(users) && users.length > 0) {
      adminId = (users[0] as any).id;
      
      // ตรวจสอบว่าเชิญตัวเองหรือเปล่า
      if (adminId === payload.userId) {
        return NextResponse.json({ success: false, message: 'ไม่สามารถเชิญตัวเองได้' }, { status: 400 });
      }
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
       WHERE owner_id = ? AND admin_id = ? AND admin_id != owner_id AND (channel_id = ? OR (channel_id IS NULL AND ? IS NULL))`,
      [payload.userId, adminId, channel_id || null, channel_id || null]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ success: false, message: 'อีเมลนี้ได้รับเชิญแล้ว' }, { status: 400 });
    }

    // สร้าง permission พร้อม invite token
    await query(
      `INSERT INTO admin_permissions (owner_id, admin_id, channel_id, permissions, status, invite_token, invite_expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [payload.userId, adminId, channel_id || null, JSON.stringify(permissions || { can_reply: true }), inviteToken, expiresAtStr]
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
  } catch (error: any) {
    console.error('Invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}
