import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import { getChannelInfo } from '@/lib/line';
import mongoose from 'mongoose';

// GET - ดึงรายการ Channels ทั้งหมด (รวม owner + admin permissions)
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

    // ดึง channels ที่ user เป็นเจ้าของ
    const ownedChannels = await LineChannel.find({ user_id: userId })
      .select('channel_name channel_id basic_id picture_url status created_at')
      .lean();

    // ดึง channel IDs ที่ user ได้รับสิทธิ์ผ่าน admin_permissions
    const adminPermissions = await AdminPermission.find({
      admin_id: userId,
      status: 'active',
    }).select('channel_id owner_id').lean();

    // ดึง channels ที่ได้รับสิทธิ์
    const permittedChannelIds = adminPermissions
      .filter(p => p.channel_id)
      .map(p => p.channel_id);
    
    // ดึง owner IDs สำหรับ permissions ที่ไม่ระบุ channel (access ทุก channel ของ owner)
    const permittedOwnerIds = adminPermissions
      .filter(p => !p.channel_id)
      .map(p => p.owner_id);

    const permittedChannels = await LineChannel.find({
      $or: [
        { _id: { $in: permittedChannelIds } },
        { user_id: { $in: permittedOwnerIds } },
      ],
      user_id: { $ne: userId }, // ไม่รวมที่เป็นเจ้าของแล้ว
    })
      .select('channel_name channel_id basic_id picture_url status created_at')
      .lean();

    // รวมผลลัพธ์
    const channels = [
      ...ownedChannels.map(c => ({ ...c, id: c._id, is_owner: true })),
      ...permittedChannels.map(c => ({ ...c, id: c._id, is_owner: false })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ success: true, data: channels });
  } catch (error) {
    console.error('Get channels error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - เพิ่ม Channel ใหม่ (เฉพาะ owner เท่านั้น)
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
    const existing = await LineChannel.findOne({
      user_id: userId,
      channel_id: channel_id,
    });

    if (existing) {
      return NextResponse.json({ success: false, message: 'Channel ID นี้มีอยู่แล้ว' }, { status: 400 });
    }

    // ดึงข้อมูล Channel จาก LINE
    let channelInfo: any = {};
    try {
      channelInfo = await getChannelInfo(channel_access_token);
    } catch (e) {
      console.error('Get channel info error:', e);
    }

    // สร้าง Webhook URL
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/${channel_id}`;

    // สร้าง channel
    const channel = new LineChannel({
      user_id: userId,
      channel_name,
      channel_id,
      channel_secret,
      channel_access_token,
      webhook_url: webhookUrl,
      basic_id: channelInfo.basicId || null,
      picture_url: channelInfo.pictureUrl || null,
    });

    await channel.save();

    return NextResponse.json({
      success: true,
      message: 'เพิ่ม Channel สำเร็จ',
      data: {
        id: channel._id,
        webhook_url: webhookUrl,
      },
    });
  } catch (error) {
    console.error('Create channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
