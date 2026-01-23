// src/app/api/broadcast/user-count/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineUser, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// GET - นับจำนวน users ที่สามารถส่ง push broadcast ได้
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

    if (!channelId) {
      return NextResponse.json({ success: false, message: 'channel_id is required' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบสิทธิ์เข้าถึง channel
    const channel = await LineChannel.findById(channelId);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    const isOwner = channel.user_id.equals(userId);
    if (!isOwner) {
      const adminPerm = await AdminPermission.findOne({
        admin_id: userId,
        owner_id: channel.user_id,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { channel_id: null }
        ]
      });
      
      if (!adminPerm || !adminPerm.permissions?.can_broadcast) {
        return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ Broadcast' }, { status: 403 });
      }
    }

    // นับจำนวน users ที่:
    // 1. เป็น source_type = 'user' (ไม่ใช่ group/room)
    // 2. follow_status != 'unfollowed' และ != 'blocked'
    // ✅ 3. line_user_id ต้องเป็นรูปแบบที่ถูกต้อง (ขึ้นต้นด้วย U + 32 hex chars)
    const count = await LineUser.countDocuments({
      channel_id: new mongoose.Types.ObjectId(channelId),
      source_type: 'user',
      follow_status: { $nin: ['unfollowed', 'blocked'] },
      line_user_id: { $regex: /^U[a-f0-9]{32}$/i } // ✅ เฉพาะ LINE User ID ที่ถูกต้อง
    });

    return NextResponse.json({ 
      success: true, 
      data: { count }
    });

  } catch (error) {
    console.error('Get user count error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}