import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// GET - Get single tag
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
      `SELECT t.*, 
              (SELECT COUNT(*) FROM conversation_tags ct WHERE ct.tag_id = t.id) as conversations_count
       FROM tags t
       WHERE t.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Tag not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error: any) {
    console.error('Error fetching tag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update tag
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

    if (body.name !== undefined) {
      // Check if name already exists for another tag
      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM tags WHERE name = ? AND id != ?',
        [body.name, id]
      );

      if (existing.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Tag name already exists' },
          { status: 400 }
        );
      }

      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      values.push(body.color);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);

    await pool.query(
      `UPDATE tags SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [updated] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM conversation_tags ct WHERE ct.tag_id = t.id) as conversations_count
       FROM tags t
       WHERE t.id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Delete tag
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

    // Remove tag from all conversations first
    await pool.query('DELETE FROM conversation_tags WHERE tag_id = ?', [id]);

    // Delete the tag
    await pool.query('DELETE FROM tags WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
