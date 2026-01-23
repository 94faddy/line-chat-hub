import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Broadcast, LineChannel, LineUser } from '@/models';
import { verifyToken } from '@/lib/auth';
import { pushMessage } from '@/lib/line';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - ดึงข้อมูล Broadcast
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

    const broadcast = await Broadcast.findById(id)
      .populate('channel_id', 'channel_name status')  // ✅ เพิ่ม status
      .lean();

    if (!broadcast) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Broadcast' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: broadcast._id,
        channel_id: (broadcast.channel_id as any)?._id,
        channel_name: (broadcast.channel_id as any)?.channel_name,
        message_type: broadcast.message_type,
        content: broadcast.content,
        target_type: broadcast.target_type,
        target_count: broadcast.target_count,
        sent_count: broadcast.sent_count,
        failed_count: broadcast.failed_count,
        status: broadcast.status,
        scheduled_at: broadcast.scheduled_at,
        sent_at: broadcast.sent_at
      }
    });
  } catch (error) {
    console.error('Get broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - ส่ง Broadcast
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

    const broadcast = await Broadcast.findById(id).populate('channel_id');
    if (!broadcast) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Broadcast' }, { status: 404 });
    }

    const channel = broadcast.channel_id as any;

    // ✅ ตรวจสอบว่า channel ยัง active อยู่
    if (channel.status !== 'active') {
      return NextResponse.json({ 
        success: false, 
        message: 'Channel นี้ถูกปิดใช้งานแล้ว ไม่สามารถส่ง Broadcast ได้' 
      }, { status: 403 });
    }

    // ตรวจสอบว่าเป็น owner หรือไม่
    if (!channel.user_id.equals(userId)) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์' }, { status: 403 });
    }

    // อัพเดทสถานะเป็น sending
    await Broadcast.findByIdAndUpdate(id, { status: 'sending' });

    // ดึง users ที่ต้องส่ง - ✅ เพิ่ม filter spam และ blocked
    const users = await LineUser.find({
      channel_id: channel._id,
      source_type: 'user',
      follow_status: { $nin: ['unfollowed', 'blocked'] },
      is_spam: { $ne: true },
      is_blocked: { $ne: true }
    }).select('line_user_id');

    let sentCount = 0;
    let failedCount = 0;

    // สร้าง message object
    const lineMessage: any = { type: 'text', text: broadcast.content };

    // ส่งข้อความทีละคน (ในโปรดักชันควรใช้ multicast)
    for (const user of users) {
      try {
        await pushMessage(channel.channel_access_token, user.line_user_id, lineMessage);
        sentCount++;
      } catch (e) {
        console.error('Send broadcast error:', e);
        failedCount++;
      }
    }

    // อัพเดทผลลัพธ์
    await Broadcast.findByIdAndUpdate(id, {
      status: 'completed',
      sent_count: sentCount,
      failed_count: failedCount,
      sent_at: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'ส่ง Broadcast สำเร็จ',
      data: { sent_count: sentCount, failed_count: failedCount }
    });
  } catch (error) {
    console.error('Send broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ Broadcast
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

    await Broadcast.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบ Broadcast สำเร็จ' });
  } catch (error) {
    console.error('Delete broadcast error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}