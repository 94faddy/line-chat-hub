import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyTokenFromRequest } from '@/lib/auth';
import { addClient, removeClient } from '@/lib/notifier';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - SSE endpoint for real-time events
export async function GET(request: NextRequest) {
  try {
    const user = verifyTokenFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Create readable stream for SSE
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    let intervalId: NodeJS.Timeout;

    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;

        // Send initial connection message
        const connectMessage = `data: ${JSON.stringify({ type: 'connected', userId: user.id })}\n\n`;
        controller.enqueue(encoder.encode(connectMessage));

        // Register client for notifications
        addClient(user.id, controller);

        // Keep connection alive with heartbeat
        intervalId = setInterval(() => {
          try {
            const heartbeat = `data: ${JSON.stringify({ type: 'heartbeat', time: Date.now() })}\n\n`;
            controller.enqueue(encoder.encode(heartbeat));
          } catch (e) {
            clearInterval(intervalId);
          }
        }, 30000); // Every 30 seconds
      },
      cancel() {
        // Cleanup when client disconnects
        if (intervalId) {
          clearInterval(intervalId);
        }
        if (streamController) {
          removeClient(user.id, streamController);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (error) {
    console.error('Events SSE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}