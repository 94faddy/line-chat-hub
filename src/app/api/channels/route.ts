import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getChannelInfo } from '@/lib/line';

// GET - ดึงรายการ Channels ทั้งหมด (รวม owner + admin permissions)
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

    // ดึง channels ที่ user เป็นเจ้าของ + channels ที่ได้รับสิทธิ์ผ่าน admin_permissions
    const channels = await query(
      `SELECT DISTINCT 
         lc.id, lc.channel_name, lc.channel_id, lc.basic_id, lc.picture_url, lc.status, lc.created_at,
         CASE WHEN lc.user_id = ? THEN 1 ELSE 0 END as is_owner
       FROM line_channels lc
       WHERE lc.user_id = ?
       
       UNION
       
       SELECT DISTINCT 
         lc.id, lc.channel_name, lc.channel_id, lc.basic_id, lc.picture_url, lc.status, lc.created_at,
         0 as is_owner
       FROM line_channels lc
       INNER JOIN admin_permissions ap ON (
         (ap.channel_id = lc.id AND ap.channel_id IS NOT NULL)
         OR (ap.owner_id = lc.user_id AND ap.channel_id IS NULL)
       )
       WHERE ap.admin_id = ? AND ap.status = 'active'
       
       ORDER BY created_at DESC`,
      [payload.userId, payload.userId, payload.userId]
    );

    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error('Get channels error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - เพิ่ม Channel ใหม่ (เฉพาะ owner เท่านั้น)
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const body = await request.json();
    const { channel_name, channel_id, channel_secret, channel_access_token } = body;

    if (!channel_name || !channel_id || !channel_secret || !channel_access_token) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    // ตรวจสอบว่า channel_id ซ้ำหรือไม่
    const existing = await query(
      'SELECT id FROM line_channels WHERE user_id = ? AND channel_id = ?',
      [payload.userId, channel_id]
    );

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ success: false, message: 'Channel ID นี้มีอยู่แล้ว' }, { status: 400 });
    }

    // ดึงข้อมูล Channel จาก LINE
    let channelInfo: any = {};
    try {
      channelInfo = await getChannelInfo(channel_access_token);
    } catch (e) {
      console.error('Get channel info error:', e);
    }

    // สร้าง Webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${channel_id}`;

    // บันทึกลงฐานข้อมูล
    const result: any = await query(
      `INSERT INTO line_channels 
       (user_id, channel_name, channel_id, channel_secret, channel_access_token, webhook_url, basic_id, picture_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.userId,
        channel_name,
        channel_id,
        channel_secret,
        channel_access_token,
        webhookUrl,
        channelInfo.basicId || null,
        channelInfo.pictureUrl || null
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'เพิ่ม Channel สำเร็จ',
      data: {
        id: result.insertId,
        webhook_url: webhookUrl
      }
    });
  } catch (error) {
    console.error('Create channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}