import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // ค้นหา user จาก token
    const users = await query<User[]>(
      'SELECT * FROM users WHERE verification_token = ? AND status = ?',
      [token, 'pending']
    );

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว' },
        { status: 400 }
      );
    }

    // อัพเดทสถานะ
    await query(
      `UPDATE users 
       SET status = 'active', 
           email_verified_at = NOW(), 
           verification_token = NULL 
       WHERE id = ?`,
      [users[0].id]
    );

    return NextResponse.json({
      success: true,
      message: 'ยืนยันอีเมลสำเร็จ',
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
