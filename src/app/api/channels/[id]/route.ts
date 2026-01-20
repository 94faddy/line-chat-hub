import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - ดึงข้อมูล Channel
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const channel = await LineChannel.findById(id).lean();
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

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
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Channel นี้' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: channel._id,
        channel_name: channel.channel_name,
        channel_id: channel.channel_id,
        channel_secret: channel.channel_secret,
        channel_access_token: channel.channel_access_token,
        webhook_url: channel.webhook_url,
        basic_id: channel.basic_id,
        picture_url: channel.picture_url,
        status: channel.status,
        isOwner,
        created_at: channel.created_at
      }
    });
  } catch (error) {
    console.error('Get channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท Channel
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
    const { channel_name, channel_secret, channel_access_token, status } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const channel = await LineChannel.findById(id);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    // ตรวจสอบว่าเป็น owner เท่านั้น
    if (!channel.user_id.equals(userId)) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่สามารถแก้ไขได้' }, { status: 403 });
    }

    // อัพเดท
    const updateData: any = {};
    if (channel_name) updateData.channel_name = channel_name;
    if (channel_secret) updateData.channel_secret = channel_secret;
    if (channel_access_token) updateData.channel_access_token = channel_access_token;
    if (status) updateData.status = status;

    await LineChannel.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดท Channel สำเร็จ' });
  } catch (error) {
    console.error('Update channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ Channel
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

    const channel = await LineChannel.findById(id);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    // ตรวจสอบว่าเป็น owner เท่านั้น
    if (!channel.user_id.equals(userId)) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่สามารถลบได้' }, { status: 403 });
    }

    await LineChannel.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบ Channel สำเร็จ' });
  } catch (error) {
    console.error('Delete channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
