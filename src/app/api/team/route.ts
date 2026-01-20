import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminPermission, User, LineChannel } from '@/models';
import { verifyToken } from '@/lib/auth';

// GET - ดึงรายการทีมงาน (admins ที่ owner เชิญ)
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
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

    const query: any = {
      owner_id: payload.userId,
    };

    if (channelId) {
      query.channel_id = channelId;
    }

    const permissions = await AdminPermission.find(query)
      .populate('admin_id', 'name email avatar')
      .populate('channel_id', 'channel_name')
      .sort({ created_at: -1 })
      .lean();

    const formattedPermissions = permissions.map((p: any) => ({
      id: p._id,
      admin: p.admin_id ? {
        id: p.admin_id._id,
        name: p.admin_id.name,
        email: p.admin_id.email,
        avatar: p.admin_id.avatar,
      } : null,
      channel: p.channel_id ? {
        id: p.channel_id._id,
        name: p.channel_id.channel_name,
      } : { id: null, name: 'ทุก Channel' },
      permissions: {
        can_reply: p.can_reply,
        can_view_all: p.can_view_all,
        can_broadcast: p.can_broadcast,
        can_manage_tags: p.can_manage_tags,
      },
      status: p.status,
      invite_token: p.invite_token,
      created_at: p.created_at,
    }));

    return NextResponse.json({ success: true, data: formattedPermissions });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
