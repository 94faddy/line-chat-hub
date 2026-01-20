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
      can_reply = true,
      can_view_all = false,
      can_broadcast = false,
      can_manage_tags = false,
    } = body;

    // ถ้าระบุ channel_id ให้ตรวจสอบว่าเป็นเจ้าของหรือไม่
    if (channel_id) {
      const channel = await LineChannel.findOne({
        _id: channel_id,
        user_id: payload.userId,
      });
      
      if (!channel) {
        return NextResponse.json({ success: false, message: 'ไม่พบ Channel หรือไม่ใช่เจ้าของ' }, { status: 404 });
      }
    }

    // สร้าง invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');

    // สร้าง AdminPermission แบบ pending
    const permission = new AdminPermission({
      owner_id: payload.userId,
      admin_id: null, // ยังไม่มีคนรับเชิญ
      channel_id: channel_id || null,
      can_reply,
      can_view_all,
      can_broadcast,
      can_manage_tags,
      status: 'pending',
      invite_token: inviteToken,
    });

    await permission.save();

    // สร้าง URL สำหรับเชิญ
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${inviteToken}`;

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
