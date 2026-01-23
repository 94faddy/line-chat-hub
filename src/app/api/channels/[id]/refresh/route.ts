// src/app/api/channels/[id]/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import { getChannelInfo } from '@/lib/line';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function ตรวจสอบสิทธิ์ can_manage_channel
async function checkManagePermission(userId: mongoose.Types.ObjectId, channel: any) {
  const isOwner = channel.user_id.equals(userId);
  
  if (isOwner) {
    return { hasPermission: true, isOwner: true };
  }

  const adminPerm = await AdminPermission.findOne({
    admin_id: userId,
    status: 'active',
    $or: [
      { channel_id: channel._id },
      { channel_id: null, owner_id: channel.user_id }
    ]
  });

  if (adminPerm && adminPerm.permissions?.can_manage_channel === true) {
    return { hasPermission: true, isOwner: false };
  }

  return { hasPermission: false, isOwner: false };
}

// POST - Refresh ข้อมูล Channel จาก LINE API
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    // ✅ เพิ่ม filter status active
    const channel = await LineChannel.findOne({
      _id: id,
      status: 'active'
    });
    
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือ Channel ถูกปิดใช้งานแล้ว' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์
    const { hasPermission } = await checkManagePermission(userId, channel);

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Channel นี้' }, { status: 403 });
    }

    // เรียก LINE API เพื่อดึงข้อมูลใหม่
    let channelInfo;
    try {
      channelInfo = await getChannelInfo(channel.channel_access_token);
    } catch (error: any) {
      console.error('LINE API Error:', error);
      return NextResponse.json({ 
        success: false, 
        message: `ไม่สามารถดึงข้อมูลจาก LINE API ได้: ${error.message || 'Unknown error'}` 
      }, { status: 500 });
    }

    // อัพเดทข้อมูลใน database
    const updateData: any = {};
    
    if (channelInfo.basicId) {
      updateData.basic_id = channelInfo.basicId;
    }
    if (channelInfo.pictureUrl) {
      updateData.picture_url = channelInfo.pictureUrl;
    }
    if (channelInfo.displayName) {
      // อัพเดทชื่อด้วยถ้าต้องการ (optional)
      // updateData.channel_name = channelInfo.displayName;
    }

    await LineChannel.findByIdAndUpdate(id, updateData);

    return NextResponse.json({
      success: true,
      message: 'อัพเดทข้อมูล Channel สำเร็จ',
      data: {
        basic_id: channelInfo.basicId || null,
        picture_url: channelInfo.pictureUrl || null,
        display_name: channelInfo.displayName || null
      }
    });
  } catch (error) {
    console.error('Refresh channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}