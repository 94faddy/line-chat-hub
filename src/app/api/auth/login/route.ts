import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 });
    }

    // ค้นหา user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // ตรวจสอบรหัสผ่าน
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // ตรวจสอบสถานะ
    if (user.status === 'pending') {
      return NextResponse.json({ success: false, message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ success: false, message: 'บัญชีของคุณถูกระงับ' }, { status: 401 });
    }

    // อัพเดท last_login
    await User.findByIdAndUpdate(user._id, { last_login: new Date() });

    // สร้าง token
    const token = createToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name
    });

    // สร้าง response พร้อม cookie
    const response = NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar
      }
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}