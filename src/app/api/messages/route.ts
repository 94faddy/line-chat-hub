import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Message, Conversation, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// Helper function ตรวจสอบสิทธิ์เข้าถึง conversation
async function checkConversationAccess(conversationId: string, userId: string): Promise<boolean> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const conversation = await Conversation.findById(conversationId).populate('channel_id', 'user_id');
  if (!conversation) return false;
  
  const channel = conversation.channel_id as any;
  if (!channel) return false;
  
  // Owner check
  if (channel.user_id.equals(userObjectId)) {
    return true;
  }
  
  // Admin check
  const adminPermission = await AdminPermission.findOne({
    admin_id: userObjectId,
    status: 'active',
    $or: [
      { channel_id: conversation.channel_id },
      { owner_id: channel.user_id, channel_id: null },
    ],
  });
  
  return !!adminPermission;
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
    const hasAccess = await checkConversationAccess(conversationId, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    // ดึงข้อความ - ใช้ lean() และ sort ด้วย index
    const messages = await Message.find({ conversation_id: conversationId })
      .select('direction message_type content media_url sticker_id package_id flex_content source_type is_read created_at')
      .sort({ created_at: 1 })
      .lean();

    // Format response
    const formattedMessages = messages.map((msg: any) => ({
      id: msg._id,
      direction: msg.direction,
      message_type: msg.message_type,
      content: msg.content,
      media_url: msg.media_url,
      sticker_id: msg.sticker_id,
      package_id: msg.package_id,
      flex_content: msg.flex_content,
      source_type: msg.source_type,
      is_read: msg.is_read,
      created_at: msg.created_at,
    }));

    return NextResponse.json({ success: true, data: formattedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
