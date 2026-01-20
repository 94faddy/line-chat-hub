import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, Message, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE - ลบการสนทนาและข้อความทั้งหมด
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

    // ดึงข้อมูลการสนทนา
    const conversation = await Conversation.findById(id).populate('channel_id');
    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const channel = conversation.channel_id as any;
    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบสิทธิ์ - เฉพาะ owner เท่านั้นที่ลบได้
    const isOwner = channel.user_id.equals(userId);
    
    if (!isOwner) {
      // Admin ที่มีสิทธิ์ full access สามารถลบได้
      const adminPerm = await AdminPermission.findOne({
        admin_id: userId,
        status: 'active',
        $or: [
          { channel_id: channel._id },
          { channel_id: null, owner_id: channel.user_id }
        ]
      });
      
      if (!adminPerm) {
        return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ลบการสนทนานี้' }, { status: 403 });
      }
    }

    // ลบข้อความทั้งหมดในการสนทนา
    await Message.deleteMany({ conversation_id: new mongoose.Types.ObjectId(id) });

    // ลบการสนทนา
    await Conversation.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบการสนทนาสำเร็จ' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// GET - ดึงข้อมูลการสนทนาเดี่ยว
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
      .populate('channel_id', 'channel_name picture_url basic_id')
      .populate('line_user_id', 'line_user_id display_name picture_url')
      .populate('tags', 'name color')
      .lean();

    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: conversation._id,
        channel_id: (conversation.channel_id as any)?._id,
        line_user_id: (conversation.line_user_id as any)?._id,
        status: conversation.status,
        last_message_preview: conversation.last_message_preview,
        last_message_at: conversation.last_message_at,
        unread_count: conversation.unread_count,
        channel: {
          id: (conversation.channel_id as any)?._id,
          channel_name: (conversation.channel_id as any)?.channel_name,
          picture_url: (conversation.channel_id as any)?.picture_url,
          basic_id: (conversation.channel_id as any)?.basic_id
        },
        line_user: {
          id: (conversation.line_user_id as any)?._id,
          line_user_id: (conversation.line_user_id as any)?.line_user_id,
          display_name: (conversation.line_user_id as any)?.display_name,
          picture_url: (conversation.line_user_id as any)?.picture_url
        },
        tags: (conversation.tags || []).map((tag: any) => ({
          id: tag._id,
          name: tag.name,
          color: tag.color
        }))
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}