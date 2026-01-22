import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { verifyToken } from '@/lib/auth';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // Debug: Log all cookies
    const allCookies = request.cookies.getAll();
    console.log('[Me] All cookies received:', allCookies.map(c => c.name));
    console.log('[Me] Request host:', request.headers.get('host'));
    
    const token = request.cookies.get('auth_token')?.value;
    
    console.log('[Me] auth_token exists:', !!token);
    
    if (!token) {
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    // ✅ Validate userId is a valid ObjectId
    if (!payload.userId || !mongoose.Types.ObjectId.isValid(payload.userId)) {
      console.error('Invalid userId format:', payload.userId);
      return NextResponse.json({ 
        success: false, 
        message: 'Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' 
      }, { status: 401 });
    }

    const user = await User.findById(payload.userId).select('-password');
    if (!user) {
      return NextResponse.json({ success: false, message: 'ไม่พบผู้ใช้' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        settings: user.settings,
        bot_api_token: user.bot_api_token
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}