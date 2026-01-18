import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies, hashPassword, verifyPassword } from '@/lib/auth';
import { RowDataPacket } from 'mysql2';

// PUT - Change password
export async function PUT(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    // Get current user
    const [users] = await pool.query<RowDataPacket[]>(
      'SELECT password FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const isValid = await verifyPassword(current_password, users[0].password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(new_password);

    // Update password
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, decoded.userId]
    );

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error: any) {
    console.error('Error changing password:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
