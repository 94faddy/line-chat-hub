import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import { getChannelInfo } from '@/lib/line';
import mongoose from 'mongoose';

// GET - ดึงรายการ Channels ทั้งหมด (owner + admin permissions)
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

    // ดึง channels ที่ user เป็น owner
    const ownedChannels = await LineChannel.find({ user_id: userId }).lean();

    // ดึง admin permissions
    const adminPerms = await AdminPermission.find({
      admin_id: userId,
      status: 'active'
    });

    // รวบรวม channel IDs ที่มีสิทธิ์เข้าถึงผ่าน admin permissions
    let additionalChannelIds: mongoose.Types.ObjectId[] = [];
    let ownerIdsForAllChannels: mongoose.Types.ObjectId[] = [];

    for (const perm of adminPerms) {
      if (perm.channel_id) {
        additionalChannelIds.push(perm.channel_id);
      } else if (perm.owner_id) {
        ownerIdsForAllChannels.push(perm.owner_id);
      }
    }

    // ดึง specific channels
    let additionalChannels: any[] = [];
    if (additionalChannelIds.length > 0) {
      additionalChannels = await LineChannel.find({
        _id: { $in: additionalChannelIds }
      }).lean();
    }

    // ดึง channels ของ owners ที่มีสิทธิ์ทั้งหมด
    let ownerChannels: any[] = [];
    if (ownerIdsForAllChannels.length > 0) {
      ownerChannels = await LineChannel.find({
        user_id: { $in: ownerIdsForAllChannels }
      }).lean();
    }

    // รวม channels ทั้งหมด (ไม่ซ้ำกัน)
    const channelMap = new Map();
    
    ownedChannels.forEach(ch => {
      channelMap.set(ch._id.toString(), { ...ch, isOwner: true });
    });
    
    additionalChannels.forEach(ch => {
      if (!channelMap.has(ch._id.toString())) {
        channelMap.set(ch._id.toString(), { ...ch, isOwner: false });
      }
    });
    
    ownerChannels.forEach(ch => {
      if (!channelMap.has(ch._id.toString())) {
        channelMap.set(ch._id.toString(), { ...ch, isOwner: false });
      }
    });

    const channels = Array.from(channelMap.values()).map(ch => ({
      id: ch._id,
      channel_name: ch.channel_name,
      channel_id: ch.channel_id,
      webhook_url: ch.webhook_url,
      basic_id: ch.basic_id,
      picture_url: ch.picture_url,
      status: ch.status,
      isOwner: ch.isOwner,
      created_at: ch.created_at
    }));

    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error('Get channels error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง Channel ใหม่
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
    const { channel_name, channel_id, channel_secret, channel_access_token } = body;

    if (!channel_name || !channel_id || !channel_secret || !channel_access_token) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบว่า channel_id ซ้ำหรือไม่
    const existingChannel = await LineChannel.findOne({ channel_id, user_id: userId });
    if (existingChannel) {
      return NextResponse.json({ success: false, message: 'Channel ID นี้มีอยู่แล้ว' }, { status: 400 });
    }

    // ดึงข้อมูล Channel จาก LINE API
    let channelInfo: any = {};
    try {
      channelInfo = await getChannelInfo(channel_access_token);
    } catch (e) {
      console.error('Get channel info error:', e);
    }

    // สร้าง Webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${channel_id}`;

    // สร้าง Channel ใหม่
    const newChannel = new LineChannel({
      user_id: userId,
      channel_name,
      channel_id,
      channel_secret,
      channel_access_token,
      webhook_url: webhookUrl,
      basic_id: channelInfo.basicId || null,
      picture_url: channelInfo.pictureUrl || null,
      status: 'active'
    });

    await newChannel.save();

    return NextResponse.json({
      success: true,
      message: 'สร้าง Channel สำเร็จ',
      data: {
        id: newChannel._id,
        webhook_url: webhookUrl
      }
    });
  } catch (error) {
    console.error('Create channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
