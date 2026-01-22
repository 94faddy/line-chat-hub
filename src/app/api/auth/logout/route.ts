import { NextRequest, NextResponse } from 'next/server';

// ดึง Cookie domain - ต้องใช้เหมือนกับ login
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

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'ออกจากระบบสำเร็จ'
    });

    const cookieDomain = getCookieDomain();
    const isProduction = process.env.NODE_ENV === 'production';
    
    console.log('[Logout] Clearing cookie with domain:', cookieDomain);
    
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
      maxAge: 0,
      path: '/',
    };
    
    if (cookieDomain) {
      cookieOptions.domain = cookieDomain;
    }
    
    response.cookies.set('auth_token', '', cookieOptions);

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}