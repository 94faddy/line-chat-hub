import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// PUT - Update user profile
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
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if email already exists for another user
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, decoded.userId]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    await pool.query(
      'UPDATE users SET name = ?, email = ? WHERE id = ?',
      [name, email, decoded.userId]
    );

    const [updated] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, email, avatar, role, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
