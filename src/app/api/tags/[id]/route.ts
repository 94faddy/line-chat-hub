//PATH: src/app/api/tags/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Tag, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ✅ Helper function ตรวจสอบสิทธิ์เข้าถึง Channel (เพิ่ม filter active)
async function checkChannelAccess(userId: mongoose.Types.ObjectId, channelId: mongoose.Types.ObjectId) {
  // ✅ ตรวจสอบว่าเป็น owner ของ channel ที่ยัง active อยู่
  const channel = await LineChannel.findOne({
    _id: channelId,
    user_id: userId,
    status: 'active'  // ✅ เพิ่ม filter
  });
  
  if (channel) return { hasAccess: true, isChannelActive: true };
  
  // ✅ ตรวจสอบว่า channel ยัง active อยู่ (สำหรับ admin)
  const channelExists = await LineChannel.findOne({
    _id: channelId,
    status: 'active'
  });
  
  if (!channelExists) {
    return { hasAccess: false, isChannelActive: false };
  }
  
  // ตรวจสอบว่าเป็น admin ที่ได้รับสิทธิ์หรือไม่
  const permission = await AdminPermission.findOne({
    admin_id: userId,
    status: 'active',
    $or: [
      { channel_id: channelId },
      { channel_id: null }
    ]
  });
  
  return { hasAccess: !!permission, isChannelActive: true };
}

// GET - ดึงข้อมูล Tag
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

    const tag = await Tag.findById(id).lean();
    if (!tag) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์เข้าถึง channel ของ tag นี้
    const { hasAccess, isChannelActive } = await checkChannelAccess(userId, tag.channel_id);
    
    // ✅ ตรวจสอบว่า channel ยัง active อยู่
    if (!isChannelActive) {
      return NextResponse.json({ success: false, message: 'Channel นี้ถูกปิดใช้งานแล้ว' }, { status: 403 });
    }
    
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Tag นี้' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: tag._id,
        channel_id: tag.channel_id,
        name: tag.name,
        color: tag.color,
        description: tag.description
      }
    });
  } catch (error) {
    console.error('Get tag error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท Tag
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
    const { name, color, description } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const tag = await Tag.findById(id);
    if (!tag) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์เข้าถึง channel ของ tag นี้
    const { hasAccess, isChannelActive } = await checkChannelAccess(userId, tag.channel_id);
    
    // ✅ ตรวจสอบว่า channel ยัง active อยู่
    if (!isChannelActive) {
      return NextResponse.json({ success: false, message: 'Channel นี้ถูกปิดใช้งานแล้ว' }, { status: 403 });
    }
    
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์แก้ไข Tag นี้' }, { status: 403 });
    }

    // ตรวจสอบชื่อซ้ำ (ถ้ามีการเปลี่ยนชื่อ)
    if (name && name !== tag.name) {
      const existingTag = await Tag.findOne({ 
        channel_id: tag.channel_id, 
        name,
        _id: { $ne: tag._id }
      });
      if (existingTag) {
        return NextResponse.json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้วใน Channel นี้' }, { status: 400 });
      }
    }

    // อัพเดท
    const updateData: any = {};
    if (name) updateData.name = name;
    if (color) updateData.color = color;
    if (description !== undefined) updateData.description = description;

    await Tag.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดท Tag สำเร็จ' });
  } catch (error) {
    console.error('Update tag error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ Tag
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

    const tag = await Tag.findById(id);
    if (!tag) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์เข้าถึง channel ของ tag นี้
    const { hasAccess, isChannelActive } = await checkChannelAccess(userId, tag.channel_id);
    
    // ✅ ตรวจสอบว่า channel ยัง active อยู่
    if (!isChannelActive) {
      return NextResponse.json({ success: false, message: 'Channel นี้ถูกปิดใช้งานแล้ว' }, { status: 403 });
    }
    
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์ลบ Tag นี้' }, { status: 403 });
    }

    await Tag.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบ Tag สำเร็จ' });
  } catch (error) {
    console.error('Delete tag error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}