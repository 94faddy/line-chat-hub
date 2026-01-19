import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

// GET - Serve media file directly as binary
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { path: pathSegments } = await params;
    
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    // สร้าง file path จาก segments
    // /api/media/2026/01/file.jpg -> ./public/uploads/2026/01/file.jpg
    const relativePath = pathSegments.join('/');
    
    // ✅ แก้ไข: เพิ่ม 'public' ให้ตรงกับ upload path
    const filePath = path.join(process.cwd(), 'public', 'uploads', relativePath);
    
    console.log(`📁 [Media API] Serving: ${filePath}`);

    // ตรวจสอบว่าไฟล์มีอยู่
    if (!existsSync(filePath)) {
      console.log(`❌ [Media API] File not found: ${filePath}`);
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // อ่านไฟล์
    const fileBuffer = await readFile(filePath);
    
    // กำหนด Content-Type ตามนามสกุลไฟล์
    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
    };
    
    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    
    console.log(`✅ [Media API] Serving ${relativePath} as ${contentType} (${fileBuffer.length} bytes)`);

    // Return file as binary response
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('Media serve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}