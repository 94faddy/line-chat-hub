import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Default settings
const defaultSettings = {
  notifications: {
    email_new_message: true,
    email_daily_report: false,
    browser_notifications: true,
    sound_enabled: true
  },
  chat: {
    auto_assign: false,
    auto_reply_enabled: true,
    working_hours_only: false,
    working_hours_start: '09:00',
    working_hours_end: '18:00'
  },
  general: {
    timezone: 'Asia/Bangkok',
    language: 'th',
    date_format: 'DD/MM/YYYY'
  }
};

// GET - Get user settings
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT settings FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    let settings = defaultSettings;
    
    if (rows[0].settings) {
      try {
        const userSettings = typeof rows[0].settings === 'string' 
          ? JSON.parse(rows[0].settings) 
          : rows[0].settings;
        settings = {
          notifications: { ...defaultSettings.notifications, ...userSettings.notifications },
          chat: { ...defaultSettings.chat, ...userSettings.chat },
          general: { ...defaultSettings.general, ...userSettings.general }
        };
      } catch (e) {
        console.error('Error parsing settings:', e);
      }
    }

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT - Update user settings
export async function PUT(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();

    // Validate settings structure
    const settings = {
      notifications: {
        email_new_message: body.notifications?.email_new_message ?? defaultSettings.notifications.email_new_message,
        email_daily_report: body.notifications?.email_daily_report ?? defaultSettings.notifications.email_daily_report,
        browser_notifications: body.notifications?.browser_notifications ?? defaultSettings.notifications.browser_notifications,
        sound_enabled: body.notifications?.sound_enabled ?? defaultSettings.notifications.sound_enabled
      },
      chat: {
        auto_assign: body.chat?.auto_assign ?? defaultSettings.chat.auto_assign,
        auto_reply_enabled: body.chat?.auto_reply_enabled ?? defaultSettings.chat.auto_reply_enabled,
        working_hours_only: body.chat?.working_hours_only ?? defaultSettings.chat.working_hours_only,
        working_hours_start: body.chat?.working_hours_start ?? defaultSettings.chat.working_hours_start,
        working_hours_end: body.chat?.working_hours_end ?? defaultSettings.chat.working_hours_end
      },
      general: {
        timezone: body.general?.timezone ?? defaultSettings.general.timezone,
        language: body.general?.language ?? defaultSettings.general.language,
        date_format: body.general?.date_format ?? defaultSettings.general.date_format
      }
    };

    await pool.query(
      'UPDATE users SET settings = ? WHERE id = ?',
      [JSON.stringify(settings), decoded.userId]
    );

    return NextResponse.json({ success: true, data: settings });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
