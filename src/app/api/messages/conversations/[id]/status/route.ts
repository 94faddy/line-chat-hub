import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH - อัพเดทสถานะการสนทนา
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { status } = body;

    if (!status || !['unread', 'read', 'processing', 'completed', 'spam'].includes(status)) {
      return NextResponse.json({ success: false, message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }

    // ดึงข้อมูลการสนทนา
    const conversation = await Conversation.findById(id).populate('channel_id');
    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const channel = conversation.channel_id as any;
    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบสิทธิ์
    const isOwner = channel.user_id.equals(userId);
    let hasPermission = isOwner;
    
    if (!isOwner) {
      const adminPerm = await AdminPermission.findOne({
        admin_id: userId,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { channel_id: null, owner_id: channel.user_id }
        ]
      });
      hasPermission = !!adminPerm;
    }

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    // อัพเดทสถานะ
    const updateData: any = { status };
    if (status === 'read' || status === 'completed') {
      updateData.unread_count = 0;
    }

    await Conversation.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดทสถานะสำเร็จ' });
  } catch (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
