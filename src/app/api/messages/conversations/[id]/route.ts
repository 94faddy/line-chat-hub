//PATH: src/app/api/messages/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Conversation, Message, AdminPermission, User, LineChannel } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ✅ Helper function ตรวจสอบสิทธิ์เข้าถึง Channel
async function checkChannelAccess(userId: mongoose.Types.ObjectId, channelId: mongoose.Types.ObjectId) {
  // ตรวจสอบว่าเป็น owner ของ channel หรือไม่
  const channel = await LineChannel.findOne({
    _id: channelId,
    user_id: userId,
  });
  
  if (channel) return true;
  
  // ตรวจสอบว่าเป็น admin ที่ได้รับสิทธิ์หรือไม่
  const permission = await AdminPermission.findOne({
    admin_id: userId,
    status: 'active',
    $or: [
      { channel_id: channelId },
      { channel_id: null }
    ]
  });
  
  return !!permission;
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
      .populate('line_user_id', 'line_user_id display_name picture_url source_type group_id room_id member_count members')
      .populate('tags', 'name color')
      .populate('assigned_to', 'name email avatar') // ✅ เพิ่ม populate assigned_to
      .lean();

    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const assignedUser = conversation.assigned_to as any;

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
        notes: conversation.notes, // ✅ เพิ่ม notes
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
          picture_url: (conversation.line_user_id as any)?.picture_url,
          source_type: (conversation.line_user_id as any)?.source_type,
          group_id: (conversation.line_user_id as any)?.group_id,
          room_id: (conversation.line_user_id as any)?.room_id,
          member_count: (conversation.line_user_id as any)?.member_count,
          members: (conversation.line_user_id as any)?.members
        },
        tags: (conversation.tags || []).map((tag: any) => ({
          id: tag._id,
          name: tag.name,
          color: tag.color
        })),
        // ✅ เพิ่ม assigned_to
        assigned_to: assignedUser ? {
          id: assignedUser._id,
          name: assignedUser.name,
          email: assignedUser.email,
          avatar: assignedUser.avatar
        } : null
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// ✅ PUT - อัพเดท notes และ assigned_to
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
    const { notes, assigned_to } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ดึงข้อมูลการสนทนา
    const conversation = await Conversation.findById(id).populate('channel_id');
    if (!conversation) {
      return NextResponse.json({ success: false, message: 'ไม่พบการสนทนา' }, { status: 404 });
    }

    const channel = conversation.channel_id as any;

    // ตรวจสอบสิทธิ์เข้าถึง
    const hasAccess = await checkChannelAccess(userId, channel._id);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์แก้ไขการสนทนานี้' }, { status: 403 });
    }

    // สร้าง update data
    const updateData: any = {};

    // อัพเดท notes (ถ้ามี)
    if (notes !== undefined) {
      updateData.notes = notes || null;
    }

    // อัพเดท assigned_to (ถ้ามี)
    if (assigned_to !== undefined) {
      if (assigned_to === null || assigned_to === '') {
        // ยกเลิกการ assign
        updateData.assigned_to = null;
      } else {
        // ตรวจสอบว่า user ที่จะ assign มีสิทธิ์เข้าถึง channel นี้หรือไม่
        const assigneeId = new mongoose.Types.ObjectId(assigned_to);
        const assigneeHasAccess = await checkChannelAccess(assigneeId, channel._id);
        
        if (!assigneeHasAccess) {
          return NextResponse.json({ 
            success: false, 
            message: 'ผู้ใช้ที่เลือกไม่มีสิทธิ์เข้าถึง Channel นี้' 
          }, { status: 400 });
        }
        
        updateData.assigned_to = assigneeId;
      }
    }

    // อัพเดท conversation
    await Conversation.findByIdAndUpdate(id, updateData);

    // ดึงข้อมูลที่อัพเดทแล้ว
    const updatedConversation = await Conversation.findById(id)
      .populate('assigned_to', 'name email avatar')
      .lean();

    const assignedUser = updatedConversation?.assigned_to as any;

    return NextResponse.json({ 
      success: true, 
      message: 'อัพเดทสำเร็จ',
      data: {
        notes: updatedConversation?.notes,
        assigned_to: assignedUser ? {
          id: assignedUser._id,
          name: assignedUser.name,
          email: assignedUser.email,
          avatar: assignedUser.avatar
        } : null
      }
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
