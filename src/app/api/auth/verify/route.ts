import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 400 });
    }

    const user = await User.findOne({ verification_token: token });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' }, { status: 400 });
    }

    // อัพเดทสถานะ
    await User.findByIdAndUpdate(user._id, {
      status: 'active',
      verification_token: null,
      email_verified_at: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'ยืนยันอีเมลสำเร็จ'
    });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
