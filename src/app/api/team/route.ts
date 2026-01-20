import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminPermission, User, LineChannel } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// GET - ดึงรายการ Team Members
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

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ดึง permissions ที่ user เป็น owner
    const permissions = await AdminPermission.find({ owner_id: userId })
      .populate('admin_id', 'email name avatar')
      .populate('channel_id', 'channel_name')
      .lean();

    const formattedMembers = permissions.map(perm => ({
      id: perm._id,
      admin_id: perm.admin_id ? (perm.admin_id as any)._id : null,
      admin_email: perm.admin_id ? (perm.admin_id as any).email : null,
      admin_name: perm.admin_id ? (perm.admin_id as any).name : null,
      admin_avatar: perm.admin_id ? (perm.admin_id as any).avatar : null,
      channel_id: perm.channel_id ? (perm.channel_id as any)._id : null,
      channel_name: perm.channel_id ? (perm.channel_id as any).channel_name : 'ทุก Channel',
      permissions: perm.permissions,
      status: perm.status,
      invite_token: perm.status === 'pending' ? perm.invite_token : undefined,
      invited_at: perm.invited_at,
      accepted_at: perm.accepted_at
    }));

    return NextResponse.json({ success: true, data: formattedMembers });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}