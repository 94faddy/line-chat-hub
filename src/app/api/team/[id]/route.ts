import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - อัพเดท permissions
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const body = await request.json();
    const { permissions, channel_id } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const permission = await AdminPermission.findOne({ _id: id, owner_id: userId });
    if (!permission) {
      return NextResponse.json({ success: false, message: 'ไม่พบหรือไม่มีสิทธิ์' }, { status: 404 });
    }

    // อัพเดท
    const updateData: any = {};
    if (permissions) updateData.permissions = permissions;
    if (channel_id !== undefined) {
      updateData.channel_id = channel_id ? new mongoose.Types.ObjectId(channel_id) : null;
    }

    await AdminPermission.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดทสำเร็จ' });
  } catch (error) {
    console.error('Update team member error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ team member / ยกเลิกคำเชิญ
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    const userId = new mongoose.Types.ObjectId(payload.userId);

    const permission = await AdminPermission.findOne({ _id: id, owner_id: userId });
    if (!permission) {
      return NextResponse.json({ success: false, message: 'ไม่พบหรือไม่มีสิทธิ์' }, { status: 404 });
    }

    await AdminPermission.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบสำเร็จ' });
  } catch (error) {
    console.error('Delete team member error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
