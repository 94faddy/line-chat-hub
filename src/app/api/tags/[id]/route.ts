import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Tag } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
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

    const tag = await Tag.findOne({ _id: id, user_id: userId }).lean();
    if (!tag) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: tag._id,
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

    const tag = await Tag.findOne({ _id: id, user_id: userId });
    if (!tag) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
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

    const tag = await Tag.findOne({ _id: id, user_id: userId });
    if (!tag) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
    }

    await Tag.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบ Tag สำเร็จ' });
  } catch (error) {
    console.error('Delete tag error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
