import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

interface RouteParams {
  params: { id: string };
}

// GET - ดึงข้อมูล Channel
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

    const channels = await query(
      `SELECT * FROM line_channels WHERE id = ? AND user_id = ?`,
      [params.id, payload.userId]
    );

    if (!Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    // ไม่ส่ง secret และ token กลับไป
    const channel = channels[0] as any;
    delete channel.channel_secret;
    delete channel.channel_access_token;

    return NextResponse.json({ success: true, data: channel });
  } catch (error) {
    console.error('Get channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท Channel
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

    const body = await request.json();
    const { channel_name, channel_secret, channel_access_token, status } = body;

    // ตรวจสอบ ownership
    const existing = await query(
      'SELECT id FROM line_channels WHERE id = ? AND user_id = ?',
      [params.id, payload.userId]
    );

    if (!Array.isArray(existing) || existing.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    // อัพเดทเฉพาะฟิลด์ที่ส่งมา
    const updates: string[] = [];
    const values: any[] = [];

    if (channel_name) {
      updates.push('channel_name = ?');
      values.push(channel_name);
    }
    if (channel_secret) {
      updates.push('channel_secret = ?');
      values.push(channel_secret);
    }
    if (channel_access_token) {
      updates.push('channel_access_token = ?');
      values.push(channel_access_token);
    }
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    values.push(params.id, payload.userId);

    await query(
      `UPDATE line_channels SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    return NextResponse.json({ success: true, message: 'อัพเดท Channel สำเร็จ' });
  } catch (error) {
    console.error('Update channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ Channel
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

    const result: any = await query(
      'DELETE FROM line_channels WHERE id = ? AND user_id = ?',
      [params.id, payload.userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'ลบ Channel สำเร็จ' });
  } catch (error) {
    console.error('Delete channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
