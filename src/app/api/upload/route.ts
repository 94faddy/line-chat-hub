import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Config
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  'application/pdf',
];

// POST - อัพโหลดไฟล์
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'general'; // general, image, video, audio

    if (!file) {
      return NextResponse.json({ success: false, message: 'กรุณาเลือกไฟล์' }, { status: 400 });
    }

    // ตรวจสอบขนาดไฟล์
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, message: 'ไฟล์ใหญ่เกิน 10MB' }, { status: 400 });
    }

    // ตรวจสอบประเภทไฟล์
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'ประเภทไฟล์ไม่รองรับ' }, { status: 400 });
    }

    // ตรวจสอบประเภทไฟล์ตาม type ที่ระบุ
    if (type === 'image' && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'กรุณาอัพโหลดไฟล์รูปภาพ' }, { status: 400 });
    }
    if (type === 'video' && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'กรุณาอัพโหลดไฟล์วิดีโอ' }, { status: 400 });
    }
    if (type === 'audio' && !ALLOWED_AUDIO_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: 'กรุณาอัพโหลดไฟล์เสียง' }, { status: 400 });
    }

    // สร้างชื่อไฟล์ใหม่
    const ext = path.extname(file.name) || getExtension(file.type);
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileName = `${randomName}${ext}`;

    // สร้าง path ตามวันที่
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const relativePath = `uploads/${year}/${month}`;
    const uploadDir = path.join(process.cwd(), 'public', relativePath);

    // สร้าง directory ถ้ายังไม่มี
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // บันทึกไฟล์
    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // URL สำหรับเข้าถึงไฟล์
    const fileUrl = `/${relativePath}/${fileName}`;

    return NextResponse.json({
      success: true,
      message: 'อัพโหลดสำเร็จ',
      data: {
        url: fileUrl,
        filename: fileName,
        original_name: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}

// Helper: ดึงนามสกุลจาก mime type
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/m4a': '.m4a',
    'application/pdf': '.pdf',
  };
  
  return map[mimeType] || '';
}
