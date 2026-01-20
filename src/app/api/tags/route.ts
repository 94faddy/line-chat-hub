import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Tag, AdminPermission, Conversation } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// Helper: ดึง owner IDs ที่ user มีสิทธิ์เข้าถึง
async function getAccessibleOwnerIds(userId: string): Promise<string[]> {
  const ownerIds = [userId];
  
  const permissions = await AdminPermission.find({
    admin_id: userId,
    status: 'active',
  }).select('owner_id').lean();
  
  permissions.forEach((p: any) => {
    if (p.owner_id) {
      const ownerId = p.owner_id.toString();
      if (!ownerIds.includes(ownerId)) {
        ownerIds.push(ownerId);
      }
    }
  });
  
  return ownerIds;
}

// GET - List all tags (รวม owner + admin permissions)
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

    // ดึง owner IDs ที่มีสิทธิ์เข้าถึง
    const ownerIds = await getAccessibleOwnerIds(payload.userId);

    const tags = await Tag.find({
      user_id: { $in: ownerIds },
    }).sort({ name: 1 }).lean();

    // นับ conversations_count สำหรับแต่ละ tag
    const tagsWithCount = await Promise.all(
      tags.map(async (tag: any) => {
        const count = await Conversation.countDocuments({ tags: tag._id });
        return {
          ...tag,
          id: tag._id,
          conversations_count: count,
        };
      })
    );

    return NextResponse.json({ success: true, data: tagsWithCount });
  } catch (error: any) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST - Create new tag (สร้างในชื่อ owner ของตัวเอง)
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
    const { name, color, description } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: 'กรุณาระบุชื่อ Tag' }, { status: 400 });
    }

    // ตรวจสอบชื่อซ้ำ (ของ user นี้)
    const existing = await Tag.findOne({
      name,
      user_id: payload.userId,
    });

    if (existing) {
      return NextResponse.json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้ว' }, { status: 400 });
    }

    const tag = new Tag({
      user_id: payload.userId,
      name,
      color: color || '#06C755',
      description: description || null,
    });

    await tag.save();

    return NextResponse.json({
      success: true,
      data: {
        ...tag.toJSON(),
        id: tag._id,
        conversations_count: 0,
      },
    });
  } catch (error: any) {
    console.error('Error creating tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
