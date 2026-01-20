import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, Tag, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - ดึง tags ของการสนทนา
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

    const conversation = await Conversation.findById(id)
      .populate('tags', 'name color')
      .lean();

    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const tags = (conversation.tags || []).map((tag: any) => ({
      id: tag._id,
      name: tag.name,
      color: tag.color
    }));

    return NextResponse.json({ success: true, data: tags });
  } catch (error) {
    console.error('Get conversation tags error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท tags ของการสนทนา
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
    const { tag_ids } = body;

    if (!Array.isArray(tag_ids)) {
      return NextResponse.json({ success: false, message: 'tag_ids ต้องเป็น array' }, { status: 400 });
    }

    // ดึงข้อมูลการสนทนา
    const conversation = await Conversation.findById(id).populate('channel_id');
    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const channel = conversation.channel_id as any;
    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบสิทธิ์
    const isOwner = channel.user_id.equals(userId);
    let hasPermission = isOwner;
    
    if (!isOwner) {
      const adminPerm = await AdminPermission.findOne({
        admin_id: userId,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { channel_id: null, owner_id: channel.user_id }
        ]
      });
      hasPermission = !!adminPerm;
    }

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึงการสนทนานี้' }, { status: 403 });
    }

    // อัพเดท tags
    const tagObjectIds = tag_ids.map((id: string) => new mongoose.Types.ObjectId(id));
    await Conversation.findByIdAndUpdate(id, { tags: tagObjectIds });

    return NextResponse.json({ success: true, message: 'อัพเดท tags สำเร็จ' });
  } catch (error) {
    console.error('Update conversation tags error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
