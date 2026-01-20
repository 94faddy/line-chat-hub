import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { verifyToken, getTokenFromCookies } from '@/lib/auth';

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    
    const token = getTokenFromCookies(request);
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Check if email already exists for another user
    const existing = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: decoded.userId },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'อีเมลนี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      decoded.userId,
      { name, email: email.toLowerCase() },
      { new: true }
    ).select('-password -verification_token -reset_token -reset_token_expires -__v');

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
