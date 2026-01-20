import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { verifyToken } from '@/lib/auth';

// GET - ดึงการตั้งค่าของผู้ใช้
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

    const user = await User.findById(payload.userId).select('settings').lean();

    if (!user) {
      return NextResponse.json({ success: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    // Default settings
    const defaultSettings = {
      notification_sound: true,
      desktop_notification: true,
      email_notification: false,
      auto_reply: false,
      auto_reply_message: '',
      theme: 'light',
      language: 'th',
      message_preview: true,
      enter_to_send: true,
    };

    const settings = { ...defaultSettings, ...(user.settings || {}) };

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// PUT - อัพเดทการตั้งค่า
export async function PUT(request: NextRequest) {
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

    // Validate และ sanitize settings
    const allowedKeys = [
      'notification_sound',
      'desktop_notification',
      'email_notification',
      'auto_reply',
      'auto_reply_message',
      'theme',
      'language',
      'message_preview',
      'enter_to_send',
    ];

    const user = await User.findById(payload.userId);
    if (!user) {
      return NextResponse.json({ success: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    // Merge settings
    const currentSettings = user.settings || {};
    const newSettings: any = { ...currentSettings };

    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        newSettings[key] = body[key];
      }
    }

    user.settings = newSettings;
    await user.save();

    return NextResponse.json({ success: true, message: 'บันทึกการตั้งค่าสำเร็จ', data: newSettings });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
