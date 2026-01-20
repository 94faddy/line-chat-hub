import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';

// GET - ดึง bot token (masked)
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

    if (!user) {
      return NextResponse.json({ success: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    // Mask token: แสดงแค่ 8 ตัวแรก และ 4 ตัวท้าย
    let maskedToken = null;
    if (user.bot_api_token) {
      const token = user.bot_api_token;
      if (token.length > 12) {
        maskedToken = token.substring(0, 8) + '...' + token.substring(token.length - 4);
      } else {
        maskedToken = '***';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        has_token: !!user.bot_api_token,
        masked_token: maskedToken,
      },
    });
  } catch (error) {
    console.error('Get bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง/รีเซ็ต bot token ใหม่
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

    // สร้าง token ใหม่: prefix + random + user_id_hash
    const prefix = 'lch_'; // Line Chat Hub
    const randomPart = crypto.randomBytes(24).toString('hex');
    const userIdHash = crypto.createHash('sha256').update(payload.userId).digest('hex').substring(0, 8);
    const newToken = `${prefix}${randomPart}${userIdHash}`;

    await User.findByIdAndUpdate(payload.userId, { bot_api_token: newToken });

    return NextResponse.json({
      success: true,
      message: 'สร้าง API Token สำเร็จ',
      data: {
        token: newToken, // แสดง full token ครั้งเดียวตอนสร้าง
      },
    });
  } catch (error) {
    console.error('Generate bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ bot token
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

    await User.findByIdAndUpdate(payload.userId, { $unset: { bot_api_token: 1 } });

    return NextResponse.json({ success: true, message: 'ลบ API Token สำเร็จ' });
  } catch (error) {
    console.error('Delete bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
