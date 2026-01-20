import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { generateResetToken } from '@/lib/auth';
import { sendResetPasswordEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'กรุณากรอกอีเมล' },
        { status: 400 }
      );
    }

    // ค้นหา user
    const user = await User.findOne({
      email: email.toLowerCase(),
      status: 'active',
    });

    if (!user) {
      // ไม่เปิดเผยว่าอีเมลไม่มีในระบบเพื่อความปลอดภัย
      return NextResponse.json({
        success: true,
        message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้',
      });
    }

    // สร้าง reset token
    const resetToken = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 ชั่วโมง

    // บันทึก token
    user.reset_token = resetToken;
    user.reset_token_expires = expiresAt;
    await user.save();

    // ส่งอีเมล
    try {
      await sendResetPasswordEmail(email, user.name, resetToken);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    return NextResponse.json({
      success: true,
      message: 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    );
  }
}
