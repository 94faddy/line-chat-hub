import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Get single auto reply
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
      `SELECT ar.*, lc.name as channel_name
       FROM auto_replies ar
       LEFT JOIN line_channels lc ON ar.channel_id = lc.id
       WHERE ar.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Auto reply not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Error fetching auto reply:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update auto reply
export async function PUT(
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
    const body = await request.json();

    const updates: string[] = [];
    const values: any[] = [];

    if (body.channel_id !== undefined) {
      updates.push('channel_id = ?');
      values.push(body.channel_id || null);
    }
    if (body.keyword !== undefined) {
      updates.push('keyword = ?');
      values.push(body.keyword);
    }
    if (body.match_type !== undefined) {
      updates.push('match_type = ?');
      values.push(body.match_type);
    }
    if (body.response_type !== undefined) {
      updates.push('response_type = ?');
      values.push(body.response_type);
    }
    if (body.response_content !== undefined) {
      updates.push('response_content = ?');
      values.push(body.response_content);
    }
    if (body.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(body.is_active);
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?');
      values.push(body.priority);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);

    await pool.query(
      `UPDATE auto_replies SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await pool.query<RowDataPacket[]>(
      `SELECT ar.*, lc.name as channel_name
       FROM auto_replies ar
       LEFT JOIN line_channels lc ON ar.channel_id = lc.id
       WHERE ar.id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error('Error updating auto reply:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete auto reply
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

    await pool.query('DELETE FROM auto_replies WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting auto reply:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
