import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - List all tags
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
      SELECT t.*, 
             (SELECT COUNT(*) FROM conversation_tags ct WHERE ct.tag_id = t.id) as conversations_count
      FROM tags t
      ORDER BY t.name ASC
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create new tag
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
    const { name, color, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Tag name is required' },
        { status: 400 }
      );
    }

    // Check if tag name already exists
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM tags WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Tag name already exists' },
        { status: 400 }
      );
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO tags (name, color, description) VALUES (?, ?, ?)`,
      [name, color || '#06C755', description || null]
    );

    const [newTag] = await pool.query<RowDataPacket[]>(
      `SELECT *, 0 as conversations_count FROM tags WHERE id = ?`,
      [result.insertId]
    );

    return NextResponse.json({ success: true, data: newTag[0] });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
