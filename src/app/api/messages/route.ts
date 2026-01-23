import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, Message, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// Helper function ตรวจสอบสิทธิ์เข้าถึง conversation
async function checkConversationAccess(conversationId: string, userId: string): Promise<{ hasAccess: boolean; isChannelActive: boolean }> {
  const conversation = await Conversation.findById(conversationId).populate('channel_id');
  if (!conversation) return { hasAccess: false, isChannelActive: false };

  const channel = conversation.channel_id as any;
  const userObjId = new mongoose.Types.ObjectId(userId);

  // ✅ ตรวจสอบว่า channel ยัง active อยู่
  if (channel.status !== 'active') {
    return { hasAccess: false, isChannelActive: false };
  }

  // ตรวจสอบว่าเป็น owner หรือไม่
  if (channel.user_id.equals(userObjId)) return { hasAccess: true, isChannelActive: true };

  // ตรวจสอบ admin permissions
  const adminPerm = await AdminPermission.findOne({
    admin_id: userObjId,
    status: 'active',
    $or: [
      { channel_id: channel._id },
      { channel_id: null, owner_id: channel.user_id }
    ]
  });

  return { hasAccess: !!adminPerm, isChannelActive: true };
}

// GET - ดึงข้อความทั้งหมดในการสนทนา
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
    const conversationId = searchParams.get('conversation_id');

    if (!conversationId) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุ conversation_id' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์การเข้าถึง
    const { hasAccess, isChannelActive } = await checkConversationAccess(conversationId, payload.userId);
    
    // ✅ ตรวจสอบว่า channel ยัง active อยู่
    if (!isChannelActive) {
      return NextResponse.json({ success: false, message: 'Channel นี้ถูกปิดใช้งานแล้ว' }, { status: 403 });
    }
    
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    const messages = await Message.find({ conversation_id: conversationId })
      .select('message_id direction message_type content media_url sticker_id package_id flex_content source_type is_read sender_info sent_by created_at')
      .populate('sent_by', 'name email avatar') // ✅ Populate ข้อมูลคนส่ง
      .sort({ created_at: 1 })
      .lean();

    // แปลง _id เป็น id
    const formattedMessages = messages.map(msg => ({
      id: msg._id,
      message_id: msg.message_id, // ✅ เพิ่ม LINE message ID สำหรับ duplicate check
      direction: msg.direction,
      message_type: msg.message_type,
      content: msg.content,
      media_url: msg.media_url,
      sticker_id: msg.sticker_id,
      package_id: msg.package_id,
      flex_content: msg.flex_content,
      source_type: msg.source_type,
      is_read: msg.is_read,
      sender_info: msg.sender_info, // ✅ ข้อมูลคนส่งในกลุ่ม LINE
      // ✅ ข้อมูล admin ที่ตอบข้อความ
      sent_by: msg.sent_by ? {
        id: (msg.sent_by as any)._id,
        name: (msg.sent_by as any).name,
        avatar: (msg.sent_by as any).avatar
      } : null,
      created_at: msg.created_at
    }));

    return NextResponse.json({ success: true, data: formattedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}