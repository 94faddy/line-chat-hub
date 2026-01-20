import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { addClient, removeClient } from '@/lib/notifier';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - SSE connection
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    // ดึง token จาก query string (สำหรับ EventSource)
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return new Response('Invalid Token', { status: 401 });
    }

    const userId = payload.userId;

    // สร้าง ReadableStream สำหรับ SSE
    const stream = new ReadableStream({
      start(controller) {
        // ส่ง initial connection message
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`));

        // เพิ่ม client เข้า notifier
        addClient(userId, controller);

        // Keep-alive: ส่ง ping ทุก 30 วินาที
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(pingInterval);
          }
        }, 30000);

        // Cleanup เมื่อ connection ถูกปิด
        request.signal.addEventListener('abort', () => {
          clearInterval(pingInterval);
          removeClient(userId, controller);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        // Connection cancelled
        removeClient(userId, undefined as any);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // สำหรับ nginx
      },
    });
  } catch (error) {
    console.error('SSE error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
