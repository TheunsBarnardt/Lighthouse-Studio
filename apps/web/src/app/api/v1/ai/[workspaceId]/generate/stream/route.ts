import type { GenerateInput } from '@platform/core';

import { getGenerationService } from '@/lib/server/ai-service';
import { requestContext } from '@/lib/server/api-helpers';

interface Params {
  workspaceId: string;
}

/**
 * POST /api/v1/ai/:workspaceId/generate/stream
 *
 * Streams an AI generation as Server-Sent Events.
 * Body: GenerateInput (promptId, inputs, stage, plus optional fields).
 *
 * SSE event format:
 *   data: <JSON-serialised GenerationEvent>\n\n
 *
 * The stream ends with a `done` or `error` event.
 */
export async function POST(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  let body: Partial<GenerateInput>;
  try {
    body = (await req.json()) as Partial<GenerateInput>;
  } catch {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!body.promptId || !body.inputs || !body.stage) {
    return new Response('promptId, inputs, and stage are required', { status: 400 });
  }

  const input: GenerateInput = {
    promptId: body.promptId,
    inputs: body.inputs,
    stage: body.stage,
    ...(body.artifactId !== undefined ? { artifactId: body.artifactId } : {}),
    ...(body.cacheControl !== undefined ? { cacheControl: body.cacheControl } : {}),
    ...(body.workspaceProviderOverride !== undefined
      ? { workspaceProviderOverride: body.workspaceProviderOverride }
      : {}),
    ...(body.includeWriteTools !== undefined ? { includeWriteTools: body.includeWriteTools } : {}),
  };

  const encoder = new TextEncoder();
  const service = getGenerationService();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of service.generateStream(ctx, input)) {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
          // Close immediately after the terminal events
          if (event.type === 'done' || event.type === 'error') break;
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
