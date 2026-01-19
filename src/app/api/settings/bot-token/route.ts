import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import crypto from 'crypto';

// GET - ดึง bot token ของ user
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const users = await query(
      `SELECT bot_api_token FROM users WHERE id = ?`,
      [payload.userId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบ user' }, { status: 404 });
    }

    const user = users[0] as any;

    return NextResponse.json({
      success: true,
      data: {
        bot_api_token: user.bot_api_token || null
      }
    });
  } catch (error) {
    console.error('Get bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// POST - สร้าง bot token ใหม่
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    // สร้าง token ใหม่ (32 bytes = 64 characters hex)
    const newBotToken = crypto.randomBytes(32).toString('hex');

    await query(
      `UPDATE users SET bot_api_token = ? WHERE id = ?`,
      [newBotToken, payload.userId]
    );

    console.log(`🔑 Generated new bot token for user ${payload.userId}`);

    return NextResponse.json({
      success: true,
      message: 'สร้าง Bot API Token สำเร็จ',
      data: {
        bot_api_token: newBotToken
      }
    });
  } catch (error) {
    console.error('Generate bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// DELETE - ลบ bot token (revoke)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    await query(
      `UPDATE users SET bot_api_token = NULL WHERE id = ?`,
      [payload.userId]
    );

    console.log(`🗑️ Revoked bot token for user ${payload.userId}`);

    return NextResponse.json({
      success: true,
      message: 'ยกเลิก Bot API Token สำเร็จ'
    });
  } catch (error) {
    console.error('Revoke bot token error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}