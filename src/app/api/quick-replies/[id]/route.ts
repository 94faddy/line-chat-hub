import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { QuickReply, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
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

// GET - ดึงข้อมูล Quick Reply และเพิ่ม use_count
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

    const quickReply = await QuickReply.findById(id).lean();
    if (!quickReply) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์เข้าถึง channel
    const hasAccess = await hasChannelAccess(userId, quickReply.channel_id);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อความตอบกลับนี้' }, { status: 403 });
    }

    // เพิ่ม use_count
    await QuickReply.findByIdAndUpdate(id, { $inc: { use_count: 1 } });

    return NextResponse.json({
      success: true,
      data: {
        id: quickReply._id,
        title: quickReply.title,
        shortcut: quickReply.shortcut,
        message_type: quickReply.message_type,
        content: quickReply.content,
        flex_content: quickReply.flex_content,
        media_url: quickReply.media_url,
        channel_id: quickReply.channel_id
      }
    });
  } catch (error) {
    console.error('Get quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท Quick Reply
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
    const { title, shortcut, message_type, content, flex_content, media_url, channel_id } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const quickReply = await QuickReply.findById(id);
    if (!quickReply) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์เข้าถึง channel ปัจจุบัน
    const hasAccess = await hasChannelAccess(userId, quickReply.channel_id);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อความตอบกลับนี้' }, { status: 403 });
    }

    // ถ้าเปลี่ยน channel ต้องตรวจสอบสิทธิ์ channel ใหม่ด้วย
    if (channel_id && channel_id !== quickReply.channel_id.toString()) {
      const newChannelId = new mongoose.Types.ObjectId(channel_id);
      const hasNewChannelAccess = await hasChannelAccess(userId, newChannelId);
      if (!hasNewChannelAccess) {
        return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึง Channel ที่เลือก' }, { status: 403 });
      }
    }

    // อัพเดท
    const updateData: any = {};
    if (title) updateData.title = title;
    if (shortcut !== undefined) updateData.shortcut = shortcut;
    if (message_type) updateData.message_type = message_type;
    if (content) updateData.content = content;
    if (flex_content !== undefined) updateData.flex_content = flex_content;
    if (media_url !== undefined) updateData.media_url = media_url;
    if (channel_id) updateData.channel_id = new mongoose.Types.ObjectId(channel_id);

    await QuickReply.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดทข้อความตอบกลับสำเร็จ' });
  } catch (error) {
    console.error('Update quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ Quick Reply
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

    const quickReply = await QuickReply.findById(id);
    if (!quickReply) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์เข้าถึง channel
    const hasAccess = await hasChannelAccess(userId, quickReply.channel_id);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์ลบข้อความตอบกลับนี้' }, { status: 403 });
    }

    await QuickReply.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบข้อความตอบกลับสำเร็จ' });
  } catch (error) {
    console.error('Delete quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}