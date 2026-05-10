import type { NextRequest } from 'next/server';

import type { MemberEvent } from '@/lib/server/member-event-bus';

import { memberEventBus } from '@/lib/server/member-event-bus';
import { verifySessionFromRequest } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ workspaceId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { workspaceId } = await params;
  const encoder = new TextEncoder();

  function sseEvent(event: MemberEvent): Uint8Array {
    const data = JSON.stringify(event);
    return encoder.encode(`event: member\ndata: ${data}\n\n`);
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send initial connection confirmation
      controller.enqueue(encoder.encode(': connected\n\n'));

      const unsubscribe = memberEventBus.subscribe(workspaceId, (event) => {
        controller.enqueue(sseEvent(event));
      });

      // Heartbeat every 25 s keeps the connection alive through proxies
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 25_000);

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
