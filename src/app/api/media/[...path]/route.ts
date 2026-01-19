import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// GET - Serve image file with proper headers for LINE
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // รับ path จาก URL
    const filePath = params.path.join('/');
    const fullPath = path.join(process.cwd(), 'public', 'uploads', filePath);

    // ตรวจสอบว่าไฟล์มีอยู่หรือไม่
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // อ่านไฟล์
    const fileBuffer = await readFile(fullPath);

    // กำหนด content type ตาม extension
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.m4a':
        contentType = 'audio/mp4';
        break;
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
    }

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Media serve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
