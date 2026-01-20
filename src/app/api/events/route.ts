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
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let intervalId: NodeJS.Timeout;
    let clientId: string;

    const stream = new ReadableStream({
      start(c) {
        controller = c;
        clientId = `${user.id}_${Date.now()}`;

        // Send initial connection message
        const connectMessage = `data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`;
        controller.enqueue(encoder.encode(connectMessage));

        // Register client for notifications
        const sendEvent = (event: any) => {
          try {
            const message = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (e) {
            console.error('Error sending SSE event:', e);
          }
        };

        addClient(user.id, clientId, sendEvent);

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
        if (clientId) {
          removeClient(user.id, clientId);
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
