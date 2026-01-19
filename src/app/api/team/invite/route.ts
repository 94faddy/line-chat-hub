import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, generateVerificationToken } from '@/lib/auth';

// POST - สร้าง invite link
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
    const { channel_id, permissions } = body;

    // สร้าง invite token
    const inviteToken = generateVerificationToken();
    
    // กำหนดวันหมดอายุ (7 วัน)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

    // ลบ pending invites เก่าที่ยังไม่มีคนรับ (ของ owner นี้)
    await query(
      `DELETE FROM admin_permissions 
       WHERE owner_id = ? AND admin_id = owner_id AND status = 'pending' AND invite_token IS NOT NULL
       AND (channel_id = ? OR (channel_id IS NULL AND ? IS NULL))`,
      [payload.userId, channel_id || null, channel_id || null]
    );

    // สร้าง permission พร้อม invite token
    // ใช้ owner_id เป็น placeholder สำหรับ admin_id
    // เมื่อ user รับ invite จะอัพเดท admin_id เป็น user ที่รับ
    const permissionsData = permissions || { can_reply: true };
    
    const result: any = await query(
      `INSERT INTO admin_permissions (owner_id, admin_id, channel_id, permissions, status, invite_token, invite_expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [payload.userId, payload.userId, channel_id || null, JSON.stringify(permissionsData), inviteToken, expiresAtStr]
    );

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invite?token=${inviteToken}`;

    console.log(`🔗 [Team Invite] Created invite link for user ${payload.userId}, token: ${inviteToken}`);

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
  } catch (error: any) {
    console.error('Invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}