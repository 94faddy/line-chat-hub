import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: ตรวจสอบสิทธิ์เข้าถึง channel
async function checkChannelAccess(channelId: string, userId: number): Promise<{ hasAccess: boolean; isOwner: boolean }> {
  // เช็คว่าเป็น owner
  const ownerCheck = await query(
    'SELECT id FROM line_channels WHERE id = ? AND user_id = ?',
    [channelId, userId]
  );
  
  if (Array.isArray(ownerCheck) && ownerCheck.length > 0) {
    return { hasAccess: true, isOwner: true };
  }
  
  // เช็คว่าเป็น admin
  const adminCheck = await query(
    `SELECT ap.id FROM admin_permissions ap
     INNER JOIN line_channels lc ON (
       (ap.channel_id = lc.id AND ap.channel_id IS NOT NULL)
       OR (ap.owner_id = lc.user_id AND ap.channel_id IS NULL)
     )
     WHERE lc.id = ? AND ap.admin_id = ? AND ap.status = 'active'`,
    [channelId, userId]
  );
  
  if (Array.isArray(adminCheck) && adminCheck.length > 0) {
    return { hasAccess: true, isOwner: false };
  }
  
  return { hasAccess: false, isOwner: false };
}

// GET - ดึงข้อมูล channel เดียว
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const { id: channelId } = await params;

    // ตรวจสอบสิทธิ์
    const { hasAccess } = await checkChannelAccess(channelId, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Channel นี้' }, { status: 403 });
    }

    const channels = await query(
      `SELECT * FROM line_channels WHERE id = ?`,
      [channelId]
    );

    if (!Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: channels[0] });
  } catch (error: any) {
    console.error('Error fetching channel:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท channel (เฉพาะ owner)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const { id: channelId } = await params;
    const body = await request.json();
    const { channel_name, channel_access_token, channel_secret } = body;

    // ตรวจสอบว่าเป็นเจ้าของ channel (admin แก้ไขไม่ได้)
    const { isOwner } = await checkChannelAccess(channelId, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่แก้ไขได้' }, { status: 403 });
    }

    // อัพเดท channel
    await query(
      `UPDATE line_channels 
       SET channel_name = ?, channel_access_token = ?, channel_secret = ?, updated_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [channel_name, channel_access_token, channel_secret, channelId, payload.userId]
    );

    return NextResponse.json({ success: true, message: 'อัพเดท Channel สำเร็จ' });
  } catch (error: any) {
    console.error('Error updating channel:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ channel (เฉพาะ owner)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const { id: channelId } = await params;

    // ตรวจสอบว่าเป็นเจ้าของ channel
    const existing = await query(
      `SELECT id, channel_name FROM line_channels WHERE id = ? AND user_id = ?`,
      [channelId, payload.userId]
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือไม่มีสิทธิ์' }, { status: 404 });
    }

    const channelName = (existing[0] as any).channel_name;

    // ลบข้อมูลที่เกี่ยวข้องทั้งหมด
    try {
      await query(`DELETE FROM messages WHERE channel_id = ?`, [channelId]);
      await query(`DELETE FROM conversations WHERE channel_id = ?`, [channelId]);
      await query(`DELETE FROM line_users WHERE channel_id = ?`, [channelId]);
      await query(`DELETE FROM admin_permissions WHERE channel_id = ?`, [channelId]);
      
      try {
        await query(`DELETE FROM rich_menus WHERE channel_id = ?`, [channelId]);
      } catch (e) {}
      
      try {
        await query(`DELETE FROM broadcast_logs WHERE channel_id = ?`, [channelId]);
      } catch (e) {}

      await query(
        `DELETE FROM line_channels WHERE id = ? AND user_id = ?`,
        [channelId, payload.userId]
      );

      console.log(`🗑️ Channel deleted: ${channelName} (ID: ${channelId}) by user ${payload.userId}`);

      return NextResponse.json({ 
        success: true, 
        message: `ลบ Channel "${channelName}" สำเร็จ` 
      });
    } catch (deleteError: any) {
      console.error('Error deleting channel data:', deleteError);
      return NextResponse.json({ 
        success: false, 
        message: 'ไม่สามารถลบข้อมูลได้: ' + deleteError.message 
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error deleting channel:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}