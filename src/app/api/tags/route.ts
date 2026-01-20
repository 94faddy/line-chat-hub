import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Tag } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

// GET - ดึงรายการ Tags ทั้งหมด
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
    const tags = await Tag.find({ user_id: userId }).sort({ name: 1 }).lean();

    const formattedTags = tags.map(tag => ({
      id: tag._id,
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

// POST - สร้าง Tag ใหม่
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
      return NextResponse.json({ success: false, message: 'กรุณากรอกชื่อ Tag' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // ตรวจสอบว่าชื่อซ้ำหรือไม่
    const existingTag = await Tag.findOne({ user_id: userId, name });
    if (existingTag) {
      return NextResponse.json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้ว' }, { status: 400 });
    }

    const newTag = new Tag({
      user_id: userId,
      name,
      color: color || '#06C755',
      description: description || null
    });

    await newTag.save();

    return NextResponse.json({
      success: true,
      message: 'สร้าง Tag สำเร็จ',
      data: { id: newTag._id }
    });
  } catch (error) {
    console.error('Create tag error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
