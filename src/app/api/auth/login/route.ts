import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { createToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// ดึง Cookie domain
const getCookieDomain = (): string | undefined => {
  if (process.env.COOKIE_DOMAIN) {
    return process.env.COOKIE_DOMAIN;
  }
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const url = new URL(appUrl);
      return url.hostname;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

// แปลง JWT_EXPIRES_IN เป็น seconds สำหรับ cookie maxAge
const getMaxAgeSeconds = (): number => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  // Parse format: 1d, 7d, 24h, 60m, 3600s
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  if (!match) {
    return 7 * 24 * 60 * 60; // default 7 days
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return value * 24 * 60 * 60; // days to seconds
    case 'h': return value * 60 * 60;       // hours to seconds
    case 'm': return value * 60;            // minutes to seconds
    case 's': return value;                 // already seconds
    default: return 7 * 24 * 60 * 60;
  }
};

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    if (user.status === 'pending') {
      return NextResponse.json({ success: false, message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' }, { status: 401 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({ success: false, message: 'บัญชีของคุณถูกระงับ' }, { status: 401 });
    }

    await User.findByIdAndUpdate(user._id, { last_login: new Date() });

    const token = createToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name
    });

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

    const cookieDomain = getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';
    const maxAge = getMaxAgeSeconds();
    
    // Debug log
    console.log('[Login] NODE_ENV:', process.env.NODE_ENV);
    console.log('[Login] JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN);
    console.log('[Login] Cookie maxAge (seconds):', maxAge);
    console.log('[Login] Cookie maxAge (days):', (maxAge / 86400).toFixed(2));
    console.log('[Login] COOKIE_DOMAIN:', cookieDomain);
    
    const cookieOptions: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      maxAge: number;
      path: string;
      domain?: string;
    } = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: maxAge,
      path: '/',
    };
    
    if (cookieDomain) {
      cookieOptions.domain = cookieDomain;
    }
    
    response.cookies.set('auth_token', token, cookieOptions);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}