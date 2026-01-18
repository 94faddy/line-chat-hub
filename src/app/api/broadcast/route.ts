import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { sendBroadcastMessage } from '@/lib/line';

// GET - List all broadcasts
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
      SELECT b.*, lc.name as channel_name
      FROM broadcasts b
      LEFT JOIN line_channels lc ON b.channel_id = lc.id
      ORDER BY b.created_at DESC
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    console.error('Error fetching broadcasts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Create and send broadcast
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
    const { channel_id, message_type, content, target_type, scheduled_at } = body;

    if (!channel_id || !content) {
      return NextResponse.json(
        { success: false, error: 'Channel and content are required' },
        { status: 400 }
      );
    }

    // Get channel info
    const [channels] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM line_channels WHERE id = ?',
      [channel_id]
    );

    if (channels.length === 0) {
      return NextResponse.json({ success: false, error: 'Channel not found' }, { status: 404 });
    }

    const channel = channels[0];

    // Count followers
    const [followerCount] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM line_users WHERE channel_id = ? AND is_blocked = 0',
      [channel_id]
    );

    const targetCount = followerCount[0].count;

    // Create broadcast record
    const status = scheduled_at ? 'scheduled' : 'sending';
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO broadcasts (channel_id, message_type, content, target_type, target_count, status, scheduled_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [channel_id, message_type || 'text', content, target_type || 'all', targetCount, status, scheduled_at || null, decoded.userId]
    );

    const broadcastId = result.insertId;

    // If not scheduled, send immediately
    if (!scheduled_at) {
      try {
        // Get all followers
        const [users] = await pool.query<RowDataPacket[]>(
          'SELECT line_user_id FROM line_users WHERE channel_id = ? AND is_blocked = 0',
          [channel_id]
        );

        let sentCount = 0;
        let failedCount = 0;

        // Send message to each user
        for (const user of users) {
          try {
            await sendBroadcastMessage(channel.access_token, user.line_user_id, {
              type: message_type || 'text',
              text: message_type === 'text' ? content : undefined,
              originalContentUrl: message_type === 'image' ? content : undefined,
              previewImageUrl: message_type === 'image' ? content : undefined
            });
            sentCount++;
          } catch (e) {
            failedCount++;
            console.error('Error sending to user:', user.line_user_id, e);
          }
        }

        // Update broadcast status
        await pool.query(
          `UPDATE broadcasts SET status = 'completed', sent_count = ?, failed_count = ?, sent_at = NOW() WHERE id = ?`,
          [sentCount, failedCount, broadcastId]
        );
      } catch (e: any) {
        // Update broadcast status to failed
        await pool.query(
          `UPDATE broadcasts SET status = 'failed' WHERE id = ?`,
          [broadcastId]
        );
        throw e;
      }
    }

    const [newBroadcast] = await pool.query<RowDataPacket[]>(
      `SELECT b.*, lc.name as channel_name
       FROM broadcasts b
       LEFT JOIN line_channels lc ON b.channel_id = lc.id
       WHERE b.id = ?`,
      [broadcastId]
    );

    return NextResponse.json({ success: true, data: newBroadcast[0] });
  } catch (error: any) {
    console.error('Error creating broadcast:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
