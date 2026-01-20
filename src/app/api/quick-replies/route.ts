import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { QuickReply, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// Helper: ดึง channel IDs ที่ user มีสิทธิ์เข้าถึง
async function getAccessibleChannelIds(userId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId[]> {
  // 1. Channels ที่ user เป็น owner
  const ownedChannels = await LineChannel.find({ user_id: userId }).select('_id').lean();
  const ownedChannelIds = ownedChannels.map(ch => ch._id);

  // 2. Channels ที่ user ถูก invite และ status = active
  const permissions = await AdminPermission.find({ 
    admin_id: userId, 
    status: 'active',
    channel_id: { $ne: null }
  }).select('channel_id').lean();
  const permittedChannelIds = permissions.map(p => p.channel_id!);

  // 3. Channels ที่ user ถูก invite แบบ "ทุก channel" (channel_id = null)
  const allChannelPermissions = await AdminPermission.find({
    admin_id: userId,
    status: 'active',
    channel_id: null
  }).select('owner_id').lean();
  
  // ดึง channels ของ owners เหล่านั้น
  const ownerIds = allChannelPermissions.map(p => p.owner_id);
  const ownerChannels = await LineChannel.find({ user_id: { $in: ownerIds } }).select('_id').lean();
  const ownerChannelIds = ownerChannels.map(ch => ch._id);

  // รวมทั้งหมด
  const allChannelIds = [...ownedChannelIds, ...permittedChannelIds, ...ownerChannelIds];
  
  // ลบ duplicates
  const uniqueIds = [...new Map(allChannelIds.map(id => [id.toString(), id])).values()];
  
  return uniqueIds;
}

// Helper: ตรวจสอบว่า user มีสิทธิ์เข้าถึง channel หรือไม่
async function hasChannelAccess(userId: mongoose.Types.ObjectId, channelId: mongoose.Types.ObjectId): Promise<boolean> {
  // 1. เป็น owner ของ channel
  const isOwner = await LineChannel.exists({ _id: channelId, user_id: userId });
  if (isOwner) return true;

  // 2. ถูก invite เข้า channel นี้โดยเฉพาะ
  const hasDirectPermission = await AdminPermission.exists({
    admin_id: userId,
    channel_id: channelId,
    status: 'active'
  });
  if (hasDirectPermission) return true;

  // 3. ถูก invite แบบ "ทุก channel" ของ owner
  const channel = await LineChannel.findById(channelId).select('user_id').lean();
  if (channel) {
    const hasAllChannelPermission = await AdminPermission.exists({
      admin_id: userId,
      owner_id: channel.user_id,
      channel_id: null,
      status: 'active'
    });
    if (hasAllChannelPermission) return true;
  }

  return false;
}

// GET - ดึงรายการ Quick Replies ของ channels ที่ user มีสิทธิ์
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
    
    // ดึง channel IDs ที่ user มีสิทธิ์
    const accessibleChannelIds = await getAccessibleChannelIds(userId);

    if (accessibleChannelIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // ดึง quick replies ของ channels เหล่านั้น
    const quickReplies = await QuickReply.find({ 
      channel_id: { $in: accessibleChannelIds },
      is_active: true 
    })
      .sort({ channel_id: 1, use_count: -1 })
      .lean();

    // ดึง channel names
    const channels = await LineChannel.find({ _id: { $in: accessibleChannelIds } })
      .select('_id channel_name')
      .lean();
    
    const channelMap = new Map(channels.map(ch => [ch._id.toString(), ch.channel_name]));

    const formattedReplies = quickReplies.map(qr => ({
      id: qr._id,
      title: qr.title,
      shortcut: qr.shortcut,
      message_type: qr.message_type,
      content: qr.content,
      flex_content: qr.flex_content,
      media_url: qr.media_url,
      channel_id: qr.channel_id,
      channel_name: channelMap.get(qr.channel_id.toString()) || null,
      is_active: qr.is_active,
      use_count: qr.use_count,
      created_by: qr.created_by,
      created_at: qr.created_at
    }));

    return NextResponse.json({ success: true, data: formattedReplies });
  } catch (error) {
    console.error('Get quick replies error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง Quick Reply ใหม่
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
    const { title, shortcut, message_type, content, flex_content, media_url, channel_id } = body;

    // ต้องระบุ channel_id
    if (!channel_id) {
      return NextResponse.json({ success: false, message: 'กรุณาเลือก LINE Channel' }, { status: 400 });
    }

    if (!title || !content) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const channelObjectId = new mongoose.Types.ObjectId(channel_id);

    // ตรวจสอบว่า user มีสิทธิ์เข้าถึง channel นี้หรือไม่
    const hasAccess = await hasChannelAccess(userId, channelObjectId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึง Channel นี้' }, { status: 403 });
    }

    const newQuickReply = new QuickReply({
      channel_id: channelObjectId,
      created_by: userId,
      title,
      shortcut: shortcut || null,
      message_type: message_type || 'text',
      content,
      flex_content: flex_content || null,
      media_url: media_url || null,
      is_active: true,
      use_count: 0
    });

    await newQuickReply.save();

    // ดึง channel name สำหรับ response
    const channel = await LineChannel.findById(channelObjectId).select('channel_name').lean();

    return NextResponse.json({
      success: true,
      message: 'สร้างข้อความตอบกลับสำเร็จ',
      data: { 
        id: newQuickReply._id,
        channel_id: channelObjectId,
        channel_name: channel?.channel_name
      }
    });
  } catch (error) {
    console.error('Create quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}