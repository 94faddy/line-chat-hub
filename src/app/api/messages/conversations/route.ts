import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET - ดึงรายการการสนทนาทั้งหมด
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channel_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let sql = `
      SELECT 
        c.id,
        c.channel_id,
        c.line_user_id,
        c.status,
        c.last_message_preview,
        c.last_message_at,
        c.unread_count,
        c.created_at,
        JSON_OBJECT(
          'id', ch.id,
          'channel_name', ch.channel_name,
          'picture_url', ch.picture_url,
          'basic_id', ch.basic_id
        ) as channel,
        JSON_OBJECT(
          'id', lu.id,
          'line_user_id', lu.line_user_id,
          'display_name', lu.display_name,
          'picture_url', lu.picture_url
        ) as line_user
      FROM conversations c
      INNER JOIN line_channels ch ON c.channel_id = ch.id
      INNER JOIN line_users lu ON c.line_user_id = lu.id
      WHERE ch.user_id = ?
    `;

    const params: any[] = [payload.userId];

    if (channelId) {
      sql += ' AND c.channel_id = ?';
      params.push(channelId);
    }

    if (status && status !== 'all') {
      sql += ' AND c.status = ?';
      params.push(status);
    }

    if (search) {
      sql += ' AND (lu.display_name LIKE ? OR c.last_message_preview LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY c.last_message_at DESC';

    const conversations = await query(sql, params);

    // ดึง tags สำหรับแต่ละ conversation
    const conversationIds = (conversations as any[]).map(c => c.id);
    let tagsMap: Map<number, any[]> = new Map();

    if (conversationIds.length > 0) {
      const tagsResult = await query(
        `SELECT ct.conversation_id, t.id, t.name, t.color
         FROM conversation_tags ct
         INNER JOIN tags t ON ct.tag_id = t.id
         WHERE ct.conversation_id IN (${conversationIds.map(() => '?').join(',')})`,
        conversationIds
      );

      if (Array.isArray(tagsResult)) {
        tagsResult.forEach((tag: any) => {
          if (!tagsMap.has(tag.conversation_id)) {
            tagsMap.set(tag.conversation_id, []);
          }
          tagsMap.get(tag.conversation_id)?.push({
            id: tag.id,
            name: tag.name,
            color: tag.color
          });
        });
      }
    }

    // Parse JSON strings and add tags
    const formattedConversations = (conversations as any[]).map(conv => ({
      ...conv,
      channel: typeof conv.channel === 'string' ? JSON.parse(conv.channel) : conv.channel,
      line_user: typeof conv.line_user === 'string' ? JSON.parse(conv.line_user) : conv.line_user,
      tags: tagsMap.get(conv.id) || []
    }));

    return NextResponse.json({ success: true, data: formattedConversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
