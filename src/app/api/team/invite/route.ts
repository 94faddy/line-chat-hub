// src/app/api/team/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminPermission, LineChannel } from '@/models';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';

// POST - สร้างลิงก์เชิญทีมงาน
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
    const { 
      channel_id,
      permissions
    } = body;

    // รองรับทั้งแบบส่ง permissions มาเป็น object หรือแบบแยกแต่ละตัว
    const can_reply = permissions?.can_reply ?? body.can_reply ?? true;
    const can_view_all = permissions?.can_view_all ?? body.can_view_all ?? false;
    const can_broadcast = permissions?.can_broadcast ?? body.can_broadcast ?? false;
    const can_manage_tags = permissions?.can_manage_tags ?? body.can_manage_tags ?? false;
    const can_manage_channel = permissions?.can_manage_channel ?? body.can_manage_channel ?? false;

    // ✅ ถ้าระบุ channel_id ให้ตรวจสอบว่าเป็นเจ้าของและ channel ยัง active อยู่
    if (channel_id) {
      const channel = await LineChannel.findOne({
        _id: channel_id,
        user_id: payload.userId,
        status: 'active'  // ✅ เพิ่ม filter
      });
      
      if (!channel) {
        return NextResponse.json({ success: false, message: 'ไม่พบ Channel, ไม่ใช่เจ้าของ, หรือ Channel ถูกปิดใช้งานแล้ว' }, { status: 404 });
      }
    }

    // สร้าง invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // สร้าง AdminPermission แบบ pending
    const permission = new AdminPermission({
      owner_id: payload.userId,
      admin_id: null, // ยังไม่มีคนรับเชิญ
      channel_id: channel_id || null,
      permissions: {
        can_reply,
        can_view_all,
        can_broadcast,
        can_manage_tags,
        can_manage_channel,
      },
      status: 'pending',
      invite_token: inviteToken,
    });

    await permission.save();

    // สร้าง URL สำหรับเชิญ (ใช้หน้า /auth/accept-invite)
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/accept-invite?token=${inviteToken}`;

    return NextResponse.json({
      success: true,
      data: {
        id: permission._id,
        invite_token: inviteToken,
        invite_url: inviteUrl,
      },
    });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}