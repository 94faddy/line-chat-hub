import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, Tag, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function ตรวจสอบสิทธิ์เข้าถึง conversation และได้ owner_id
async function checkConversationAccessWithOwner(conversationId: string, userId: string): Promise<{ hasAccess: boolean; ownerId: string | null }> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  const conversation = await Conversation.findById(conversationId).populate('channel_id', 'user_id');
  if (!conversation) return { hasAccess: false, ownerId: null };
  
  const channel = conversation.channel_id as any;
  if (!channel) return { hasAccess: false, ownerId: null };
  
  const ownerId = channel.user_id.toString();
  
  if (channel.user_id.equals(userObjectId)) {
    return { hasAccess: true, ownerId };
  }
  
  const adminPermission = await AdminPermission.findOne({
    admin_id: userObjectId,
    status: 'active',
    $or: [
      { channel_id: conversation.channel_id },
      { owner_id: channel.user_id, channel_id: null },
    ],
  });
  
  if (adminPermission) {
    return { hasAccess: true, ownerId };
  }
  
  return { hasAccess: false, ownerId: null };
}

// GET - ดึง tags ของ conversation
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // ตรวจสอบสิทธิ์การเข้าถึง
    const { hasAccess } = await checkConversationAccessWithOwner(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    const conversation = await Conversation.findById(id).populate('tags', 'name color description');

    return NextResponse.json({ success: true, data: conversation?.tags || [] });
  } catch (error) {
    console.error('Get conversation tags error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท tags ของ conversation
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
    const { tags } = body;

    if (!Array.isArray(tags)) {
      return NextResponse.json({ success: false, message: 'tags ต้องเป็น array' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์และได้ owner_id (ใช้ tags ของ owner)
    const { hasAccess, ownerId } = await checkConversationAccessWithOwner(id, payload.userId);
    if (!hasAccess || !ownerId) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    // ตรวจสอบว่า tags เป็นของ owner หรือไม่
    const validTags = await Tag.find({
      _id: { $in: tags },
      user_id: ownerId,
    }).select('_id');

    const validTagIds = validTags.map(t => t._id);

    // อัพเดท tags
    await Conversation.findByIdAndUpdate(id, { tags: validTagIds });

    return NextResponse.json({ success: true, message: 'อัพเดท tags สำเร็จ' });
  } catch (error) {
    console.error('Update conversation tags error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
