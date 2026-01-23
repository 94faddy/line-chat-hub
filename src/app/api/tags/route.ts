//PATH: src/app/api/tags/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Tag, LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// ✅ Helper function ตรวจสอบสิทธิ์เข้าถึง Channel (เฉพาะ active)
async function checkChannelAccess(userId: mongoose.Types.ObjectId, channelId: mongoose.Types.ObjectId) {
  // ตรวจสอบว่าเป็น owner ของ channel หรือไม่ (✅ เฉพาะ active)
  const channel = await LineChannel.findOne({
    _id: channelId,
    user_id: userId,
    status: 'active' // ✅ เพิ่ม filter
  });
  
  if (channel) return true;
  
  // ✅ ตรวจสอบว่า channel ยัง active อยู่ก่อนตรวจสอบ admin permission
  const activeChannel = await LineChannel.findOne({
    _id: channelId,
    status: 'active'
  });
  
  if (!activeChannel) return false;
  
  // ตรวจสอบว่าเป็น admin ที่ได้รับสิทธิ์หรือไม่
  const permission = await AdminPermission.findOne({
    admin_id: userId,
    status: 'active',
    $or: [
      { channel_id: channelId },
      { channel_id: null } // ถ้า channel_id เป็น null = มีสิทธิ์ทุก channel
    ]
  });
  
  return !!permission;
}

// ✅ Helper function ดึง channels ที่ user มีสิทธิ์เข้าถึง (เฉพาะ active)
async function getAccessibleChannels(userId: mongoose.Types.ObjectId) {
  // 1. Channels ที่เป็น owner (✅ เฉพาะ active)
  const ownedChannels = await LineChannel.find({ 
    user_id: userId,
    status: 'active' // ✅ เพิ่ม filter
  }).select('_id').lean();
  const channelIds = ownedChannels.map(c => c._id);
  
  // 2. Channels ที่ได้รับสิทธิ์เป็น admin
  const permissions = await AdminPermission.find({
    admin_id: userId,
    status: 'active'
  }).select('channel_id owner_id').lean();
  
  for (const perm of permissions) {
    if (perm.channel_id) {
      // ✅ ตรวจสอบว่า channel ยัง active อยู่
      const activeChannel = await LineChannel.findOne({
        _id: perm.channel_id,
        status: 'active'
      }).select('_id').lean();
      
      if (activeChannel && !channelIds.some(id => id.equals(perm.channel_id!))) {
        channelIds.push(perm.channel_id);
      }
    } else {
      // channel_id = null หมายถึงมีสิทธิ์ทุก channel ของ owner (✅ เฉพาะ active)
      const ownerChannels = await LineChannel.find({ 
        user_id: perm.owner_id,
        status: 'active' // ✅ เพิ่ม filter
      }).select('_id').lean();
      for (const ch of ownerChannels) {
        if (!channelIds.some(id => id.equals(ch._id))) {
          channelIds.push(ch._id);
        }
      }
    }
  }
  
  return channelIds;
}

// GET - ดึงรายการ Tags (รองรับ filter by channel_id)
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

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const { searchParams } = new URL(request.url);
    const channelIdParam = searchParams.get('channel_id');

    let query: any = {};

    if (channelIdParam) {
      // ดึง tags ของ channel ที่ระบุ
      const channelId = new mongoose.Types.ObjectId(channelIdParam);
      
      // ตรวจสอบสิทธิ์
      const hasAccess = await checkChannelAccess(userId, channelId);
      if (!hasAccess) {
        return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Channel นี้ หรือ Channel ถูกปิดใช้งานแล้ว' }, { status: 403 });
      }
      
      query.channel_id = channelId;
    } else {
      // ดึง tags ของทุก channel ที่มีสิทธิ์เข้าถึง
      const accessibleChannelIds = await getAccessibleChannels(userId);
      query.channel_id = { $in: accessibleChannelIds };
    }

    const tags = await Tag.find(query).sort({ name: 1 }).lean();

    const formattedTags = tags.map(tag => ({
      id: tag._id,
      channel_id: tag.channel_id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      created_at: tag.created_at
    }));

    return NextResponse.json({ success: true, data: formattedTags });
  } catch (error) {
    console.error('Get tags error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง Tag ใหม่ (ต้องระบุ channel_id)
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, color, description, channel_id } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกชื่อ Tag' }, { status: 400 });
    }

    if (!channel_id) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุ Channel' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);
    const channelId = new mongoose.Types.ObjectId(channel_id);

    // ตรวจสอบสิทธิ์เข้าถึง Channel (✅ รวม active check)
    const hasAccess = await checkChannelAccess(userId, channelId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Channel นี้ หรือ Channel ถูกปิดใช้งานแล้ว' }, { status: 403 });
    }

    // ตรวจสอบว่าชื่อซ้ำหรือไม่ (ในแต่ละ channel)
    const existingTag = await Tag.findOne({ channel_id: channelId, name });
    if (existingTag) {
      return NextResponse.json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้วใน Channel นี้' }, { status: 400 });
    }

    const newTag = new Tag({
      channel_id: channelId,
      name,
      color: color || '#06C755',
      description: description || null
    });

    await newTag.save();

    return NextResponse.json({
      success: true,
      message: 'สร้าง Tag สำเร็จ',
      data: { 
        id: newTag._id,
        channel_id: newTag.channel_id,
        name: newTag.name,
        color: newTag.color
      }
    });
  } catch (error) {
    console.error('Create tag error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}