import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { sendEmail } from '@/lib/email';
import crypto from 'crypto';

// POST - Request password reset
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ 
        success: true,
        message: 'หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่าน' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to user
    await User.findByIdAndUpdate(user._id, {
      reset_token: resetTokenHash,
      reset_token_expiry: resetTokenExpiry
    });

    // Build reset URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;

    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - LINE Chat Hub',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #00B900;">Password Reset Request</h2>
            <p>Hello ${user.name},</p>
            <p>You requested to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #00B900; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p style="color: #999; font-size: 12px;">This link will expire in 1 hour.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">LINE Chat Hub</p>
          </div>
        `
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      // Don't reveal email sending failure
    }

    return NextResponse.json({ 
      success: true,
      message: 'หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่าน' 
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}