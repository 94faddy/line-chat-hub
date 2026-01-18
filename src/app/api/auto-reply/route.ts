import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - List all auto replies
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT ar.*, lc.name as channel_name
      FROM auto_replies ar
      LEFT JOIN line_channels lc ON ar.channel_id = lc.id
      ORDER BY ar.priority DESC, ar.created_at DESC
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error fetching auto replies:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new auto reply
export async function POST(request: NextRequest) {
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
    const { channel_id, keyword, match_type, response_type, response_content, is_active, priority } = body;

    if (!keyword || !response_content) {
      return NextResponse.json(
        { success: false, error: 'Keyword and response content are required' },
        { status: 400 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO auto_replies (channel_id, keyword, match_type, response_type, response_content, is_active, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [channel_id || null, keyword, match_type || 'contains', response_type || 'text', response_content, is_active !== false, priority || 0]
    );

    const [newReply] = await pool.query<RowDataPacket[]>(
      `SELECT ar.*, lc.name as channel_name
       FROM auto_replies ar
       LEFT JOIN line_channels lc ON ar.channel_id = lc.id
       WHERE ar.id = ?`,
      [result.insertId]
    );

    return NextResponse.json({ success: true, data: newReply[0] });
  } catch (error: any) {
    console.error('Error creating auto reply:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
