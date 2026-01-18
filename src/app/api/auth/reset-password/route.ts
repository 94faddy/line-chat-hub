import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { success: false, message: 'ข้อมูลไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    // ค้นหา user จาก token
    const users = await query<User[]>(
      `SELECT * FROM users 
       WHERE reset_token = ? 
       AND reset_token_expires > NOW()`,
      [token]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const user = users[0];

    // Hash password ใหม่
    const hashedPassword = await hashPassword(password);

    // อัพเดท password และลบ token
    await query(
      `UPDATE users 
       SET password = ?, 
           reset_token = NULL, 
           reset_token_expires = NULL 
       WHERE id = ?`,
      [hashedPassword, user.id]
    );

    return NextResponse.json({
      success: true,
      message: 'รีเซ็ตรหัสผ่านสำเร็จ',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
