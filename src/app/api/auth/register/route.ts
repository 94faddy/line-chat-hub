import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { sendVerificationEmail } from '@/lib/email';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    // ตรวจสอบว่า email ซ้ำหรือไม่
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // สร้าง verification token
    const verificationToken = uuidv4();

    // สร้าง user ใหม่
    const newUser = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: 'user',
      status: 'pending',
      verification_token: verificationToken
    });

    await newUser.save();

    // ส่ง verification email
    try {
      await sendVerificationEmail(email, verificationToken);
    } catch (e) {
      console.error('Send verification email error:', e);
    }

    return NextResponse.json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี'
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
