import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// GET - ดึง Bot API Token
export async function GET(request: NextRequest) {
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

    const user = await User.findById(payload.userId).select('bot_api_token').lean();

    return NextResponse.json({
      success: true,
      data: { bot_api_token: user?.bot_api_token || null }
    });
  } catch (error) {
    console.error('Get bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง/รีเซ็ต Bot API Token
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

    // สร้าง token ใหม่
    const botApiToken = `bot_${uuidv4().replace(/-/g, '')}`;

    await User.findByIdAndUpdate(payload.userId, { bot_api_token: botApiToken });

    return NextResponse.json({
      success: true,
      message: 'สร้าง Bot API Token สำเร็จ',
      data: { bot_api_token: botApiToken }
    });
  } catch (error) {
    console.error('Generate bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ Bot API Token
export async function DELETE(request: NextRequest) {
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

    await User.findByIdAndUpdate(payload.userId, { bot_api_token: null });

    return NextResponse.json({ success: true, message: 'ลบ Bot API Token สำเร็จ' });
  } catch (error) {
    console.error('Delete bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}