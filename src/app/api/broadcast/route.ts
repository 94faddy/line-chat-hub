import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineChannel, LineUser, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// GET - ดึงรายการ Broadcasts ทั้งหมด
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

    // ดึง channel IDs ที่มีสิทธิ์เข้าถึง
    const ownedChannels = await LineChannel.find({ user_id: userId }).select('_id');
    const ownedChannelIds = ownedChannels.map(ch => ch._id);

    const broadcasts = await Broadcast.find({
      channel_id: { $in: ownedChannelIds }
    })
      .populate('channel_id', 'channel_name')
      .sort({ created_at: -1 })
      .lean();

    const formattedBroadcasts = broadcasts.map(bc => ({
      id: bc._id,
      channel_id: (bc.channel_id as any)?._id,
      channel_name: (bc.channel_id as any)?.channel_name,
      message_type: bc.message_type,
      content: bc.content,
      target_type: bc.target_type,
      target_count: bc.target_count,
      sent_count: bc.sent_count,
      failed_count: bc.failed_count,
      status: bc.status,
      scheduled_at: bc.scheduled_at,
      sent_at: bc.sent_at,
      created_at: bc.created_at
    }));

    return NextResponse.json({ success: true, data: formattedBroadcasts });
  } catch (error) {
    console.error('Get broadcasts error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง Broadcast ใหม่
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { channel_id, message_type, content, target_type, scheduled_at } = body;

    if (!channel_id || !content) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบว่า channel เป็นของ user หรือไม่
    const channel = await LineChannel.findOne({ _id: channel_id, user_id: userId });
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือไม่มีสิทธิ์' }, { status: 404 });
    }

    // นับจำนวน users
    const targetCount = await LineUser.countDocuments({ channel_id, is_blocked: false });

    const newBroadcast = new Broadcast({
      channel_id: new mongoose.Types.ObjectId(channel_id),
      message_type: message_type || 'text',
      content,
      target_type: target_type || 'all',
      target_count: targetCount,
      sent_count: 0,
      failed_count: 0,
      status: scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at || null,
      created_by: userId
    });

    await newBroadcast.save();

    return NextResponse.json({
      success: true,
      message: 'สร้าง Broadcast สำเร็จ',
      data: { id: newBroadcast._id }
    });
  } catch (error) {
    console.error('Create broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
