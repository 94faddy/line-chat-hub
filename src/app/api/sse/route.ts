import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import { addClient, removeClient } from '@/lib/notifier';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const { searchParams } = new URL(request.url);
    // รับ token จาก query string หรือ cookie
    let token = searchParams.get('token');
    
    if (!token) {
      token = request.cookies.get('auth_token')?.value || null;
    }
    
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return new Response('Invalid Token', { status: 401 });
    }

    const userId = payload.userId;

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`));

        addClient(userId, controller);

        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            clearInterval(pingInterval);
          }
        }, 30000);

        request.signal.addEventListener('abort', () => {
          clearInterval(pingInterval);
          removeClient(userId, controller);
          try {
            controller.close();
          } catch {}
        });
      },
      cancel() {
        removeClient(userId, undefined as any);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('SSE error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}