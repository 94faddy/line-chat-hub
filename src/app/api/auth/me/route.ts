import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { User } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'ไม่ได้เข้าสู่ระบบ' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, message: 'Token ไม่ถูกต้อง' },
        { status: 401 }
      );
    }

    const users = await query<User[]>(
      `SELECT id, email, name, avatar, role, status, email_verified_at, last_login, created_at 
       FROM users WHERE id = ?`,
      [payload.userId]
    );

    if (users.length === 0) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบผู้ใช้' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: users[0],
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
