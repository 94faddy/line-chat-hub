import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminPermission, User } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ token: string }>;
}

// GET - ตรวจสอบ invite token
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    
    const { token } = await params;

    const permission = await AdminPermission.findOne({
      invite_token: token,
      status: 'pending'
    }).populate('owner_id', 'name email')
      .populate('channel_id', 'channel_name');

    if (!permission) {
      return NextResponse.json({ success: false, message: 'คำเชิญไม่ถูกต้องหรือหมดอายุ' }, { status: 404 });
    }

    // ตรวจสอบว่าหมดอายุหรือยัง
    if (permission.invite_expires_at && new Date() > permission.invite_expires_at) {
      return NextResponse.json({ success: false, message: 'คำเชิญหมดอายุแล้ว' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: {
        owner_name: (permission.owner_id as any)?.name || 'Unknown',
        owner_email: (permission.owner_id as any)?.email || '',
        channel_name: permission.channel_id 
          ? (permission.channel_id as any)?.channel_name 
          : 'ทุก Channel',
        permissions: permission.permissions
      }
    });
  } catch (error) {
    console.error('Check invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - รับคำเชิญ
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await connectDB();
    
    const { token } = await params;
    
    // ตรวจสอบว่า login แล้วหรือยัง
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json({ 
        success: false, 
        require_login: true,
        message: 'กรุณาเข้าสู่ระบบก่อน' 
      }, { status: 200 }); // ส่ง 200 เพื่อให้ frontend อ่าน require_login ได้
    }

    const payload = verifyToken(authToken);
    if (!payload) {
      return NextResponse.json({ 
        success: false, 
        require_login: true,
        message: 'Token ไม่ถูกต้อง' 
      }, { status: 200 });
    }

    const permission = await AdminPermission.findOne({
      invite_token: token,
      status: 'pending'
    });

    if (!permission) {
      return NextResponse.json({ success: false, message: 'คำเชิญไม่ถูกต้องหรือหมดอายุ' }, { status: 404 });
    }

    // ตรวจสอบว่าหมดอายุหรือยัง
    if (permission.invite_expires_at && new Date() > permission.invite_expires_at) {
      return NextResponse.json({ success: false, message: 'คำเชิญหมดอายุแล้ว' }, { status: 400 });
    }

    const userId = new mongoose.Types.ObjectId(payload.userId);

    // อัพเดท permission
    await AdminPermission.findByIdAndUpdate(permission._id, {
      admin_id: userId,
      status: 'active',
      invite_token: null,
      invite_expires_at: null,
      accepted_at: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'ยอมรับคำเชิญสำเร็จ'
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}