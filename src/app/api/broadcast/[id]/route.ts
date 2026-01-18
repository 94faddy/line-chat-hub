import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Get single broadcast
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, lc.channel_name as channel_name
       FROM broadcasts b
       LEFT JOIN line_channels lc ON b.channel_id = lc.id
       WHERE b.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Broadcast not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Error fetching broadcast:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete broadcast
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;

    // Check if broadcast is still pending/scheduled
    const [broadcasts] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM broadcasts WHERE id = ?',
      [id]
    );

    if (broadcasts.length === 0) {
      return NextResponse.json({ success: false, error: 'Broadcast not found' }, { status: 404 });
    }

    const broadcast = broadcasts[0];

    // Cannot delete if sending
    if (broadcast.status === 'sending') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete broadcast while sending' },
        { status: 400 }
      );
    }

    await pool.query('DELETE FROM broadcasts WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting broadcast:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}