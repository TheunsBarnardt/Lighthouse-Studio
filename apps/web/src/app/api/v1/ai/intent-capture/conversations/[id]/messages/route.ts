import { requestContext } from '@/lib/server/api-helpers';
import { getIntentCaptureService } from '@/lib/server/intent-capture-service';

interface Params {
  id: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const body = (await req.json()) as { message: string; model?: string };
  const message = body.message.trim();
  const model = typeof body.model === 'string' && body.model.length > 0 ? body.model : undefined;
  if (!message) {
    return new Response(JSON.stringify({ code: 'VALIDATION', message: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const service = getIntentCaptureService();

  // NOTE: the chat UI now sends a `model` field selected by the user. Provider
  // routing through `GenerationService.providerOverride` is a follow-up; for
  // now we accept and log the preference so the picker UX is honoured client-
  // side, and the backend can adopt the param when prompts are model-agnostic.
  // See model-registry.ts and ADR-0284 (TODO).
  if (model) {
    // The cast is safe: ctx is RequestContext + we know it carries correlationId.
    (ctx as unknown as { _selectedModel?: string })._selectedModel = model;
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of service.sendMessage(ctx, params.id, message)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        const errEvent = {
          type: 'error',
          code: 'internal_error',
          message: e instanceof Error ? e.message : String(e),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errEvent)}\n\n`));
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
    },
  });
}
