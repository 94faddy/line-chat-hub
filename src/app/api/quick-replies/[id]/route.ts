// src/app/api/quick-replies/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { QuickReply, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function hasChannelAccess(userId: mongoose.Types.ObjectId, channelId: mongoose.Types.ObjectId): Promise<boolean> {
  const isOwner = await LineChannel.exists({ _id: channelId, user_id: userId });
  if (isOwner) return true;

  const hasDirectPermission = await AdminPermission.exists({
    admin_id: userId,
    channel_id: channelId,
    status: 'active'
  });
  if (hasDirectPermission) return true;

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

function normalizeQuickReply(qr: any) {
  if (qr.messages && qr.messages.length > 0) {
    return {
      id: qr._id,
      title: qr.title,
      shortcut: qr.shortcut,
      messages: qr.messages,
      channel_id: qr.channel_id,
      is_active: qr.is_active,
      use_count: qr.use_count,
      sort_order: qr.sort_order || 0
    };
  }
  
  const legacyMessage = {
    type: qr.message_type || 'text',
    content: qr.content || '',
    flex_content: qr.flex_content || null,
    media_url: qr.media_url || null
  };
  
  return {
    id: qr._id,
    title: qr.title,
    shortcut: qr.shortcut,
    messages: [legacyMessage],
    message_type: qr.message_type,
    content: qr.content,
    flex_content: qr.flex_content,
    media_url: qr.media_url,
    channel_id: qr.channel_id,
    is_active: qr.is_active,
    use_count: qr.use_count,
    sort_order: qr.sort_order || 0
  };
}

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

    const hasAccess = await hasChannelAccess(userId, quickReply.channel_id);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงข้อความตอบกลับนี้' }, { status: 403 });
    }

    await QuickReply.findByIdAndUpdate(id, { $inc: { use_count: 1 } });

    const normalized = normalizeQuickReply(quickReply);

    return NextResponse.json({
      success: true,
      data: normalized
    });
  } catch (error) {
    console.error('Get quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

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
    const { title, shortcut, messages, channel_id } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const quickReply = await QuickReply.findById(id);
    if (!quickReply) {
      return NextResponse.json({ success: false, message: 'ไม่พบข้อความตอบกลับ' }, { status: 404 });
    }

    const hasAccess = await hasChannelAccess(userId, quickReply.channel_id);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขข้อความตอบกลับนี้' }, { status: 403 });
    }

    if (channel_id && channel_id !== quickReply.channel_id.toString()) {
      const newChannelId = new mongoose.Types.ObjectId(channel_id);
      const hasNewChannelAccess = await hasChannelAccess(userId, newChannelId);
      if (!hasNewChannelAccess) {
        return NextResponse.json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึง Channel ที่เลือก' }, { status: 403 });
      }
    }

    // สร้าง update operation
    const updateOps: any = { $set: {} };

    if (title) updateOps.$set.title = title;
    if (shortcut !== undefined) updateOps.$set.shortcut = shortcut || null;
    if (channel_id) updateOps.$set.channel_id = new mongoose.Types.ObjectId(channel_id);
    
    if (messages && messages.length > 0) {
      updateOps.$set.messages = messages;
      // ลบ legacy fields
      updateOps.$unset = {
        message_type: 1,
        content: 1,
        flex_content: 1,
        media_url: 1
      };
    }

    await QuickReply.findByIdAndUpdate(id, updateOps);

    return NextResponse.json({ success: true, message: 'อัพเดทข้อความตอบกลับสำเร็จ' });
  } catch (error) {
    console.error('Update quick reply error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

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