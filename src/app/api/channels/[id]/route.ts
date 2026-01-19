import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
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

    const channelId = params.id;

    const channels = await query(
      `SELECT * FROM line_channels WHERE id = ? AND user_id = ?`,
      [channelId, payload.userId]
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

// PUT - อัพเดท channel
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

    const channelId = params.id;
    const body = await request.json();
    const { channel_name, channel_access_token, channel_secret } = body;

    // ตรวจสอบว่าเป็นเจ้าของ channel
    const existing = await query(
      `SELECT id FROM line_channels WHERE id = ? AND user_id = ?`,
      [channelId, payload.userId]
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
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

// DELETE - ลบ channel
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

    const channelId = params.id;

    // ตรวจสอบว่าเป็นเจ้าของ channel
    const existing = await query(
      `SELECT id, channel_name FROM line_channels WHERE id = ? AND user_id = ?`,
      [channelId, payload.userId]
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือไม่มีสิทธิ์' }, { status: 404 });
    }

    const channelName = (existing[0] as any).channel_name;

    // ลบข้อมูลที่เกี่ยวข้องทั้งหมด (ลบตามลำดับ foreign key)
    try {
      // 1. ลบ messages ของ channel นี้
      await query(`DELETE FROM messages WHERE channel_id = ?`, [channelId]);

      // 2. ลบ conversations ของ channel นี้
      await query(`DELETE FROM conversations WHERE channel_id = ?`, [channelId]);

      // 3. ลบ line_users ของ channel นี้
      await query(`DELETE FROM line_users WHERE channel_id = ?`, [channelId]);

      // 4. ลบ admin_permissions ของ channel นี้
      await query(`DELETE FROM admin_permissions WHERE channel_id = ?`, [channelId]);

      // 5. ลบ rich_menus ของ channel นี้ (ถ้ามี)
      try {
        await query(`DELETE FROM rich_menus WHERE channel_id = ?`, [channelId]);
      } catch (e) {
        // ไม่เป็นไร ถ้าไม่มีตาราง rich_menus
      }

      // 6. ลบ broadcast_logs ของ channel นี้ (ถ้ามี)
      try {
        await query(`DELETE FROM broadcast_logs WHERE channel_id = ?`, [channelId]);
      } catch (e) {
        // ไม่เป็นไร ถ้าไม่มีตาราง broadcast_logs
      }

      // 7. ลบ channel
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