import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';

// ✅ GET - รับ token จาก URL (สำหรับ click link ในอีเมล)
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 400 });
    }

    const result = await verifyToken(token);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// ✅ POST - รับ token จาก body (สำหรับ frontend call)
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 400 });
    }

    const result = await verifyToken(token);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// ✅ Helper function สำหรับ verify token
async function verifyToken(token: string) {
  const user = await User.findOne({ verification_token: token });
  if (!user) {
    return { success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' };
  }

  // อัพเดทสถานะ
  await User.findByIdAndUpdate(user._id, {
    status: 'active',
    verification_token: null,
    email_verified_at: new Date()
  });

  return { success: true, message: 'ยืนยันอีเมลสำเร็จ' };
}