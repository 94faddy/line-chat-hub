import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'กรุณาเลือกไฟล์' }, { status: 400 });
    }

    // ตรวจสอบประเภทไฟล์
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        success: false, 
        message: 'รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, GIF, WEBP)' 
      }, { status: 400 });
    }

    // ตรวจสอบขนาดไฟล์ (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ 
        success: false, 
        message: 'ขนาดไฟล์ต้องไม่เกิน 10MB' 
      }, { status: 400 });
    }

    // สร้างชื่อไฟล์ใหม่
    const ext = path.extname(file.name) || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    
    // สร้างโฟลเดอร์ตามวันที่
    const today = new Date();
    const dateFolder = `${today.getFullYear()}/${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', dateFolder);

    // สร้างโฟลเดอร์ถ้ายังไม่มี
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // บันทึกไฟล์
    const filePath = path.join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // สร้าง URL
    const fileUrl = `${process.env.NEXT_PUBLIC_APP_URL}/uploads/${dateFolder}/${filename}`;

    return NextResponse.json({
      success: true,
      message: 'อัพโหลดสำเร็จ',
      data: {
        filename,
        url: fileUrl,
        size: file.size,
        type: file.type
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}


