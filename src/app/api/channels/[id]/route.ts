// src/app/api/channels/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { LineChannel, AdminPermission } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper function ตรวจสอบสิทธิ์ can_manage_channel
async function checkManagePermission(userId: mongoose.Types.ObjectId, channel: any) {
  const isOwner = channel.user_id.equals(userId);
  
  if (isOwner) {
    return { hasPermission: true, isOwner: true, permissions: null };
  }

  const adminPerm = await AdminPermission.findOne({
    admin_id: userId,
    status: 'active',
    $or: [
      { channel_id: channel._id },
      { channel_id: null, owner_id: channel.user_id }
    ]
  });

  if (adminPerm && adminPerm.permissions?.can_manage_channel === true) {
    return { hasPermission: true, isOwner: false, permissions: adminPerm.permissions };
  }

  return { hasPermission: false, isOwner: false, permissions: null };
}

// GET - ดึงข้อมูล Channel
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

    const channel = await LineChannel.findById(id).lean();
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    const { hasPermission, isOwner, permissions } = await checkManagePermission(userId, channel);

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง Channel นี้' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: channel._id,
        channel_name: channel.channel_name,
        channel_id: channel.channel_id,
        channel_secret: channel.channel_secret,
        channel_access_token: channel.channel_access_token,
        webhook_url: channel.webhook_url,
        basic_id: channel.basic_id,
        picture_url: channel.picture_url,
        status: channel.status,
        isOwner,
        canEdit: true, // ถ้าเข้ามาถึงตรงนี้ได้ แปลว่ามีสิทธิ์แก้ไข
        permissions: isOwner ? {
          can_reply: true,
          can_view_all: true,
          can_broadcast: true,
          can_manage_tags: true,
          can_manage_channel: true
        } : permissions,
        created_at: channel.created_at
      }
    });
  } catch (error) {
    console.error('Get channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดท Channel
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
    const { channel_name, channel_secret, channel_access_token, status } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const channel = await LineChannel.findById(id);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    // ตรวจสอบสิทธิ์ - owner หรือ admin ที่มี can_manage_channel
    const { hasPermission } = await checkManagePermission(userId, channel);

    if (!hasPermission) {
      return NextResponse.json({ success: false, message: 'ไม่มีสิทธิ์แก้ไข Channel นี้' }, { status: 403 });
    }

    // อัพเดท
    const updateData: any = {};
    if (channel_name) updateData.channel_name = channel_name;
    if (channel_secret) updateData.channel_secret = channel_secret;
    if (channel_access_token) updateData.channel_access_token = channel_access_token;
    if (status) updateData.status = status;

    await LineChannel.findByIdAndUpdate(id, updateData);

    return NextResponse.json({ success: true, message: 'อัพเดท Channel สำเร็จ' });
  } catch (error) {
    console.error('Update channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - Soft Delete Channel (เปลี่ยน status เป็น inactive แทนการลบจริง)
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

    const channel = await LineChannel.findById(id);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    // ตรวจสอบว่าเป็น owner เท่านั้น (ลบได้เฉพาะ owner)
    if (!channel.user_id.equals(userId)) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่สามารถลบได้' }, { status: 403 });
    }

    // ✅ Soft Delete - เปลี่ยน status เป็น inactive แทนการลบจริง
    await LineChannel.findByIdAndUpdate(id, { 
      status: 'inactive',
      deleted_at: new Date() // บันทึกเวลาที่ลบ
    });

    return NextResponse.json({ 
      success: true, 
      message: 'ปิดใช้งาน Channel สำเร็จ (ข้อมูลยังคงอยู่ในระบบ)' 
    });
  } catch (error) {
    console.error('Delete channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PATCH - Restore / Hard Delete Channel
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const { action } = body;

    const userId = new mongoose.Types.ObjectId(payload.userId);

    const channel = await LineChannel.findById(id);
    if (!channel) {
      return NextResponse.json({ success: false, message: 'ไม่พบ Channel' }, { status: 404 });
    }

    // ตรวจสอบว่าเป็น owner เท่านั้น
    if (!channel.user_id.equals(userId)) {
      return NextResponse.json({ success: false, message: 'เฉพาะเจ้าของเท่านั้นที่สามารถดำเนินการได้' }, { status: 403 });
    }

    // ✅ Restore - เปิดใช้งาน Channel ที่ถูก soft delete
    if (action === 'restore') {
      await LineChannel.findByIdAndUpdate(id, { 
        status: 'active',
        $unset: { deleted_at: 1 } // ลบ field deleted_at
      });

      return NextResponse.json({ 
        success: true, 
        message: 'เปิดใช้งาน Channel สำเร็จ' 
      });
    }

    // ✅ Hard Delete - ลบถาวร (เปลี่ยน status เป็น 'deleted' + ลบ credentials)
    if (action === 'hard_delete') {
      await LineChannel.findByIdAndUpdate(id, { 
        status: 'deleted',
        deleted_at: new Date(),
        // ลบ credentials เพื่อความปลอดภัย (ใช้ empty string แทน null เพื่อไม่ให้ error)
        channel_secret: '',
        channel_access_token: ''
      });

      return NextResponse.json({ 
        success: true, 
        message: 'ลบ Channel สำเร็จ (สามารถเพิ่มใหม่เพื่อกู้คืนข้อมูลได้)' 
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Patch channel error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}