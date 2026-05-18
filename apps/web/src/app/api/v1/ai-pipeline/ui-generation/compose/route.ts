import type { NextRequest } from 'next/server';

import { recommendComposition } from '@/lib/ui-compose/recommender';

/**
 * POST /api/v1/ai-pipeline/ui-generation/compose
 *
 * Streams a UI composition as Server-Sent Events. The front-end consumes the
 * events as they arrive: assistant text deltas land in the chat, `block_insert`
 * events trigger `insertBlock` calls into the preview iframe.
 *
 * v1 (this endpoint): generation is heuristic — `recommendComposition` keyword-
 * matches the brief to blocks from the global library. The streaming envelope
 * is shaped exactly like what a real LLM call would produce, so swapping in an
 * Anthropic / OpenAI stream is a one-spot change (replace the body of the
 * `start` async function).
 *
 * Request body:
 *   { brief: string; model?: string; mode?: 'compose' | 'modify' }
 *
 * Stream events (one per `data: <json>\n\n`):
 *   { type: 'started' }
 *   { type: 'reasoning'; text: string }
 *   { type: 'text_delta'; delta: string }              // chat assistant text, streamed
 *   { type: 'block_insert'; blockId: string }          // tell the parent to drop a block
 *   { type: 'placeholder_suggestion'; blockId: string; overrides: Record<string,string> }
 *   { type: 'done' }
 *   { type: 'error'; message: string }
 */
export async function POST(request: NextRequest) {
  let body: { brief?: string; model?: string; mode?: 'compose' | 'modify' };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ code: 'VALIDATION', message: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const brief = typeof body.brief === 'string' ? body.brief : '';
  const mode = body.mode ?? 'compose';
  const composition = recommendComposition(brief);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      async function wait(ms: number) {
        await new Promise<void>((resolve) => setTimeout(resolve, ms));
      }

      try {
        send({ type: 'started' });
        await wait(120);

        send({ type: 'reasoning', text: composition.reasoning });
        await wait(80);

        // Stream a brief acknowledgement text turn for the chat panel.
        const greeting =
          mode === 'modify'
            ? 'On it — applying the requested changes.'
            : 'Composed a draft. Inserting the blocks now — you can edit any element or ask me to refine.';
        for (const word of greeting.split(' ')) {
          send({ type: 'text_delta', delta: `${word} ` });
          await wait(28);
        }

        // Insert each block, paced so the user sees them appear.
        for (const blockId of composition.blockIds) {
          send({ type: 'block_insert', blockId });
          const overrides = composition.placeholders[blockId];
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (overrides && Object.keys(overrides).length > 0) {
            send({ type: 'placeholder_suggestion', blockId, overrides });
          }
          await wait(220);
        }

        send({ type: 'done' });
      } catch (e) {
        send({
          type: 'error',
          message: e instanceof Error ? e.message : 'Unknown error',
        });
      } finally {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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
