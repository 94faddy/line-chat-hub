import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // ✅ เพิ่ม timeout settings
  connectionTimeout: 30000, // 30 วินาที
  greetingTimeout: 30000,   // 30 วินาที
  socketTimeout: 60000,     // 60 วินาที
  // ✅ เพิ่ม TLS options
  tls: {
    rejectUnauthorized: false // ยอมรับ self-signed certificate
  }
});

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'BevChat Hub';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://chat.bevchat.in';

export async function sendVerificationEmail(email: string, name: string, token: string) {
  const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #06C755 0%, #00B900 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .content h2 { color: #333; margin-top: 0; }
        .content p { color: #666; line-height: 1.6; }
        .button { display: inline-block; background: #06C755; color: white !important; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #05a847; }
        .footer { padding: 20px 30px; background: #f9f9f9; text-align: center; color: #999; font-size: 12px; }
        .code { background: #f0f0f0; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 ${APP_NAME}</h1>
        </div>
        <div class="content">
          <h2>สวัสดีคุณ ${name}!</h2>
          <p>ขอบคุณที่สมัครสมาชิกกับเรา กรุณาคลิกปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ:</p>
          <center>
            <a href="${verifyUrl}" class="button">✅ ยืนยันอีเมล</a>
          </center>
          <p>หรือคัดลอก URL ด้านล่างไปวางในเบราว์เซอร์:</p>
          <div class="code">${verifyUrl}</div>
          <p style="color: #999; font-size: 14px;">ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          <p>หากคุณไม่ได้สมัครสมาชิก กรุณาเพิกเฉยอีเมลนี้</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `🔐 ยืนยันอีเมลของคุณ - ${APP_NAME}`,
    html,
  });
}

export async function sendResetPasswordEmail(email: string, name: string, token: string) {
  const resetUrl = `${APP_URL}/auth/reset-password?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .content h2 { color: #333; margin-top: 0; }
        .content p { color: #666; line-height: 1.6; }
        .button { display: inline-block; background: #EF4444; color: white !important; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .button:hover { background: #DC2626; }
        .footer { padding: 20px 30px; background: #f9f9f9; text-align: center; color: #999; font-size: 12px; }
        .code { background: #f0f0f0; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all; margin: 15px 0; }
        .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔑 รีเซ็ตรหัสผ่าน</h1>
        </div>
        <div class="content">
          <h2>สวัสดีคุณ ${name}!</h2>
          <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่:</p>
          <center>
            <a href="${resetUrl}" class="button">🔄 รีเซ็ตรหัสผ่าน</a>
          </center>
          <p>หรือคัดลอก URL ด้านล่างไปวางในเบราว์เซอร์:</p>
          <div class="code">${resetUrl}</div>
          <div class="warning">
            <strong>⚠️ สำคัญ:</strong> ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          <p>หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `🔑 รีเซ็ตรหัสผ่าน - ${APP_NAME}`,
    html,
  });
}

export async function sendAdminInviteEmail(email: string, ownerName: string, token: string) {
  const acceptUrl = `${APP_URL}/auth/accept-invite?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .content h2 { color: #333; margin-top: 0; }
        .content p { color: #666; line-height: 1.6; }
        .button { display: inline-block; background: #8B5CF6; color: white !important; padding: 14px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .footer { padding: 20px 30px; background: #f9f9f9; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👥 คำเชิญเป็นแอดมิน</h1>
        </div>
        <div class="content">
          <h2>สวัสดี!</h2>
          <p><strong>${ownerName}</strong> ได้เชิญคุณเป็นแอดมินเพื่อช่วยตอบแชทใน ${APP_NAME}</p>
          <p>คลิกปุ่มด้านล่างเพื่อยอมรับคำเชิญ:</p>
          <center>
            <a href="${acceptUrl}" class="button">✅ ยอมรับคำเชิญ</a>
          </center>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${APP_NAME}" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `👥 คำเชิญเป็นแอดมิน - ${APP_NAME}`,
    html,
  });
}

// Generic sendEmail function (ใช้ใน API routes)
interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions) {
  const { to, subject, html, from } = options;
  
  await transporter.sendMail({
    from: from || `"${APP_NAME}" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}