import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function ตรวจสอบสิทธิ์เข้าถึง conversation
async function checkConversationAccess(conversationId: string, userId: string): Promise<boolean> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const conversation = await Conversation.findById(conversationId).populate('channel_id', 'user_id');
  if (!conversation) return false;
  
  const channel = conversation.channel_id as any;
  if (!channel) return false;
  
  if (channel.user_id.equals(userObjectId)) {
    return true;
  }
  
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

// PUT - อัพเดทสถานะการสนทนา
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    
    const { id } = await params;
    
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    const validStatuses = ['unread', 'read', 'processing', 'completed', 'spam'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ success: false, message: 'สถานะไม่ถูกต้อง' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์การเข้าถึง
    const hasAccess = await checkConversationAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    await Conversation.findByIdAndUpdate(id, { status });

    return NextResponse.json({ success: true, message: 'อัพเดทสถานะสำเร็จ' });
  } catch (error) {
    console.error('Update conversation status error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
