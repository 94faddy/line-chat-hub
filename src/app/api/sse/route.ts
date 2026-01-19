import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { addClient, removeClient, getClients } from '@/lib/notifier';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - SSE endpoint for realtime notifications
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      console.log('❌ [SSE] No auth token');
      return NextResponse.json({ success: false, message: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.log('❌ [SSE] Invalid token');
      return NextResponse.json({ success: false, message: 'Token ไม่ถูกต้อง' }, { status: 401 });
    }

    const userId = payload.userId;
    console.log(`🔌 [SSE] User ${userId} connecting...`);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Add this client to the notifier
        addClient(userId, controller);
        
        // Log current clients
        const clients = getClients();
        console.log(`✅ [SSE] User ${userId} connected. Total users with SSE: ${clients.size}`);
        clients.forEach((controllers, uid) => {
          console.log(`   - User ${uid}: ${controllers.size} connection(s)`);
        });

        // Send initial connection message
        const data = JSON.stringify({ 
          type: 'connected', 
          userId: userId,
          timestamp: new Date().toISOString() 
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30000);

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          removeClient(userId, controller);
          console.log(`🔌 [SSE] User ${userId} disconnected`);
        });
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
    return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}