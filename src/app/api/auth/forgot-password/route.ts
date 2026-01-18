import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateResetToken } from '@/lib/auth';
import { sendResetPasswordEmail } from '@/lib/email';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกอีเมล' },
        { status: 400 }
      );
    }

    // ค้นหา user
    const users = await query<User[]>(
      'SELECT * FROM users WHERE email = ? AND status = ?',
      [email, 'active']
    );

    if (users.length === 0) {
      // ไม่เปิดเผยว่าอีเมลไม่มีในระบบเพื่อความปลอดภัย
      return NextResponse.json({
        success: true,
        message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้',
      });
    }

    const user = users[0];

    // สร้าง reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 ชั่วโมง

    // บันทึก token
    await query(
      `UPDATE users 
       SET reset_token = ?, reset_token_expires = ? 
       WHERE id = ?`,
      [resetToken, expiresAt, user.id]
    );

    // ส่งอีเมล
    try {
      await sendResetPasswordEmail(email, user.name, resetToken);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
