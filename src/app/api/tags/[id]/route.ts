import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Tag, AdminPermission, Conversation } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: ตรวจสอบสิทธิ์เข้าถึง tag
async function checkTagAccess(tagId: string, userId: string): Promise<{ hasAccess: boolean; isOwner: boolean }> {
  // เช็คว่าเป็น owner ของ tag
  const tag = await Tag.findOne({
    _id: tagId,
    user_id: userId,
  });
  
  if (tag) {
    return { hasAccess: true, isOwner: true };
  }
  
  // เช็คว่าเป็น admin ที่มีสิทธิ์เข้าถึง owner ของ tag นี้
  const targetTag = await Tag.findById(tagId);
  if (!targetTag) {
    return { hasAccess: false, isOwner: false };
  }
  
  const adminPermission = await AdminPermission.findOne({
    admin_id: userId,
    owner_id: targetTag.user_id,
    status: 'active',
  });
  
  if (adminPermission) {
    return { hasAccess: true, isOwner: false };
  }
  
  return { hasAccess: false, isOwner: false };
}

// GET - Get single tag
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

    // ตรวจสอบสิทธิ์
    const { hasAccess } = await checkTagAccess(id, payload.userId);
    if (!hasAccess) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Tag นี้' }, { status: 403 });
    }

    const tag = await Tag.findById(id).lean();

    if (!tag) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Tag' }, { status: 404 });
    }

    const conversationsCount = await Conversation.countDocuments({ tags: id });

    return NextResponse.json({
      success: true,
      data: {
        ...tag,
        id: tag._id,
        conversations_count: conversationsCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PUT - Update tag (เฉพาะ owner)
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

    // ตรวจสอบว่าเป็น owner
    const { isOwner } = await checkTagAccess(id, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่แก้ไขได้' }, { status: 403 });
    }

    const updateData: any = {};

    if (body.name !== undefined) {
      // ตรวจสอบชื่อซ้ำ
      const existing = await Tag.findOne({
        name: body.name,
        _id: { $ne: id },
        user_id: payload.userId,
      });

      if (existing) {
        return NextResponse.json({ success: false, message: 'ชื่อ Tag นี้มีอยู่แล้ว' }, { status: 400 });
      }

      updateData.name = body.name;
    }
    
    if (body.color !== undefined) {
      updateData.color = body.color;
    }
    
    if (body.description !== undefined) {
      updateData.description = body.description || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีข้อมูลที่จะอัพเดท' }, { status: 400 });
    }

    const updated = await Tag.findByIdAndUpdate(id, updateData, { new: true }).lean();
    const conversationsCount = await Conversation.countDocuments({ tags: id });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        id: updated?._id,
        conversations_count: conversationsCount,
      },
    });
  } catch (error: any) {
    console.error('Error updating tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// DELETE - Delete tag (เฉพาะ owner)
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

    // ตรวจสอบว่าเป็น owner
    const { isOwner } = await checkTagAccess(id, payload.userId);
    if (!isOwner) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่ลบได้' }, { status: 403 });
    }

    // ลบ tag จาก conversations ก่อน
    await Conversation.updateMany(
      { tags: id },
      { $pull: { tags: id } }
    );

    // ลบ tag
    await Tag.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'ลบ Tag สำเร็จ' });
  } catch (error: any) {
    console.error('Error deleting tag:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
