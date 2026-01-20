import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, AdminPermission, Conversation, Message, LineUser, Broadcast } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: ตรวจสอบสิทธิ์เข้าถึง channel
async function checkChannelAccess(channelId: string, userId: string): Promise<{ hasAccess: boolean; isOwner: boolean }> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  // เช็คว่าเป็น owner
  const channel = await LineChannel.findOne({
    _id: channelId,
    user_id: userObjectId,
  });
  
  if (channel) {
    return { hasAccess: true, isOwner: true };
  }
  
  // เช็คว่าเป็น admin
  const adminCheck = await AdminPermission.findOne({
    admin_id: userObjectId,
    status: 'active',
    $or: [
      { channel_id: channelId },
      { channel_id: null }, // Has access to all channels of owner
    ],
  });
  
  if (adminCheck) {
    // Verify the channel belongs to the owner in the permission
    const targetChannel = await LineChannel.findById(channelId);
    if (targetChannel && adminCheck.owner_id.equals(targetChannel.user_id)) {
      return { hasAccess: true, isOwner: false };
    }
  }
  
  return { hasAccess: false, isOwner: false };
}

// GET - ดึงข้อมูล channel เดียว
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

    const { id: channelId } = await params;

    // ตรวจสอบสิทธิ์
    const { hasAccess } = await checkChannelAccess(channelId, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Channel นี้' }, { status: 403 });
    }

    const channel = await LineChannel.findById(channelId)
      .select('-__v')
      .lean();

    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { ...channel, id: channel._id } });
  } catch (error: any) {
    console.error('Error fetching channel:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท channel (เฉพาะ owner)
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

    const { id: channelId } = await params;
    const body = await request.json();
    const { channel_name, channel_access_token, channel_secret } = body;

    // ตรวจสอบว่าเป็นเจ้าของ channel (admin แก้ไขไม่ได้)
    const { isOwner } = await checkChannelAccess(channelId, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่แก้ไขได้' }, { status: 403 });
    }

    // อัพเดท channel
    const updated = await LineChannel.findByIdAndUpdate(
      channelId,
      { channel_name, channel_access_token, channel_secret },
      { new: true }
    );

    return NextResponse.json({ success: true, message: 'อัพเดท Channel สำเร็จ', data: updated });
  } catch (error: any) {
    console.error('Error updating channel:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ channel (เฉพาะ owner)
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

    const { id: channelId } = await params;

    // ตรวจสอบว่าเป็นเจ้าของ channel
    const channel = await LineChannel.findOne({
      _id: channelId,
      user_id: payload.userId,
    });

    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือไม่มีสิทธิ์' }, { status: 404 });
    }

    const channelName = channel.channel_name;

    // ลบข้อมูลที่เกี่ยวข้องทั้งหมด
    await Message.deleteMany({ channel_id: channelId });
    await Conversation.deleteMany({ channel_id: channelId });
    await LineUser.deleteMany({ channel_id: channelId });
    await AdminPermission.deleteMany({ channel_id: channelId });
    await Broadcast.deleteMany({ channel_id: channelId });

    // ลบ channel
    await LineChannel.findByIdAndDelete(channelId);

    console.log(`🗑️ Channel deleted: ${channelName} (ID: ${channelId}) by user ${payload.userId}`);

    return NextResponse.json({ 
      success: true, 
      message: `ลบ Channel "${channelName}" สำเร็จ` 
    });
  } catch (error: any) {
    console.error('Error deleting channel:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
