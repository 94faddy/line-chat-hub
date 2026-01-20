import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Token ไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // ค้นหา user จาก token
    const user = await User.findOne({
      verification_token: token,
      status: 'pending',
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว' },
        { status: 400 }
      );
    }

    // อัพเดทสถานะ
    user.status = 'active';
    user.email_verified_at = new Date();
    user.verification_token = undefined;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'ยืนยันอีเมลสำเร็จ',
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
