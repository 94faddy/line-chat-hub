import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';

// Helper: ดึง channel IDs ที่ user มีสิทธิ์ broadcast
async function getBroadcastableChannelIds(userId: string): Promise<string[]> {
  // Channel ที่เป็นเจ้าของ
  const ownedChannels = await LineChannel.find({ user_id: userId }).select('_id').lean();
  const channelIds = ownedChannels.map((c: any) => c._id.toString());
  
  // Channel ที่มีสิทธิ์ broadcast (via AdminPermission)
  const permissions = await AdminPermission.find({
    admin_id: userId,
    status: 'active',
    can_broadcast: true,
  }).populate('channel_id', '_id').lean();
  
  permissions.forEach((p: any) => {
    if (p.channel_id && !channelIds.includes(p.channel_id._id.toString())) {
      channelIds.push(p.channel_id._id.toString());
    }
  });
  
  return channelIds;
}

// GET - ดึงรายการ Broadcast
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
    const status = searchParams.get('status');

    // ดึง channel IDs ที่มีสิทธิ์
    const channelIds = await getBroadcastableChannelIds(payload.userId);

    if (channelIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const query: any = {
      channel_id: { $in: channelIds },
    };

    if (channelId && channelIds.includes(channelId)) {
      query.channel_id = channelId;
    }

    if (status && ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'].includes(status)) {
      query.status = status;
    }

    const broadcasts = await Broadcast.find(query)
      .populate('channel_id', 'channel_name')
      .populate('created_by', 'name')
      .sort({ created_at: -1 })
      .lean();

    const formattedBroadcasts = broadcasts.map((b: any) => ({
      ...b,
      id: b._id,
      channel_name: b.channel_id?.channel_name,
      created_by_name: b.created_by?.name,
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
    const {
      channel_id,
      title,
      message_type = 'text',
      content,
      flex_content,
      media_url,
      target_type = 'all',
      target_tags,
      scheduled_at,
    } = body;

    if (!channel_id || !title || !content) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์ broadcast ใน channel นี้
    const channelIds = await getBroadcastableChannelIds(payload.userId);
    if (!channelIds.includes(channel_id)) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ส่ง Broadcast ใน Channel นี้' }, { status: 403 });
    }

    const broadcast = new Broadcast({
      channel_id,
      title,
      message_type,
      content,
      flex_content: flex_content || null,
      media_url: media_url || null,
      target_type,
      target_tags: target_tags || [],
      scheduled_at: scheduled_at ? new Date(scheduled_at) : null,
      status: scheduled_at ? 'scheduled' : 'draft',
      created_by: payload.userId,
    });

    await broadcast.save();

    return NextResponse.json({
      success: true,
      message: 'สร้าง Broadcast สำเร็จ',
      data: { id: broadcast._id },
    });
  } catch (error) {
    console.error('Create broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
