import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
};

// GET - Serve media file
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { path: pathSegments } = await params;
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // สร้าง file path
    const relativePath = pathSegments.join('/');
    
    // ป้องกัน path traversal attack
    if (relativePath.includes('..') || relativePath.includes('//')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', relativePath);

    // ตรวจสอบว่าไฟล์อยู่ใน uploads directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // ตรวจสอบไฟล์
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // อ่านไฟล์
    const fileBuffer = await readFile(filePath);
    const fileStat = await stat(filePath);

    // หา MIME type
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // สร้าง response
    const response = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });

    return response;
  } catch (error) {
    console.error('Media serve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// HEAD - สำหรับ preflight requests (LINE ใช้ตรวจสอบ content)
export async function HEAD(request: NextRequest, { params }: RouteParams) {
  try {
    const { path: pathSegments } = await params;
    
    if (!pathSegments || pathSegments.length === 0) {
      return new NextResponse(null, { status: 404 });
    }

    const relativePath = pathSegments.join('/');
    
    if (relativePath.includes('..') || relativePath.includes('//')) {
      return new NextResponse(null, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', relativePath);
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const resolvedPath = path.resolve(filePath);
    
    if (!resolvedPath.startsWith(uploadsDir)) {
      return new NextResponse(null, { status: 403 });
    }

    if (!existsSync(filePath)) {
      return new NextResponse(null, { status: 404 });
    }

    const fileStat = await stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileStat.size.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}
