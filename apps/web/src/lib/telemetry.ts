/**
 * Client-side telemetry for the schema designer.
 *
 * Three concerns:
 *  1. Action counter  — platform_schema_designer_actions_total{action,workspace}
 *  2. Trace spans     — save / validate / preview / apply
 *  3. Error reporting — GlitchTip (Sentry-compatible) with workspace + correlation ID
 *
 * Implementation notes:
 *  - In development, events are logged to the console only.
 *  - In production, POST /api/telemetry/events batches the events; a server-side
 *    handler forwards them to the configured observability backend (OTel collector
 *    or GlitchTip DSN from NEXT_PUBLIC_GLITCHTIP_DSN).
 *  - The interface is stable; swap the implementation without touching call sites.
 */

// eslint-disable-next-line no-restricted-syntax -- NEXT_PUBLIC_* client-only
const DSN = process.env['NEXT_PUBLIC_GLITCHTIP_DSN'];
// eslint-disable-next-line no-restricted-syntax -- NEXT_PUBLIC_* client-only
const IS_DEV = process.env['NODE_ENV'] === 'development';

// ── Counter ───────────────────────────────────────────────────────────────────

/**
 * Emit platform_schema_designer_actions_total{action, workspace}.
 * Call this at the start of every designer action so the counter is monotonic.
 */
export function trackAction(action: string, workspaceId: string | null): void {
  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.debug('[telemetry] action', { action, workspaceId });
    return;
  }
  // Fire-and-forget; errors are silently discarded (telemetry must never block the UX)
  void fetch('/api/telemetry/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric: 'platform_schema_designer_actions_total',
      labels: { action, workspace: workspaceId ?? 'unknown' },
    }),
    keepalive: true,
  }).catch(() => undefined);
}

// ── Spans ─────────────────────────────────────────────────────────────────────

/**
 * Wrap an async operation in a trace span.
 * Duration is recorded via the User Timing API (performance.measure) and batched to telemetry.
 */
export async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const mark = `span:${name}:${Date.now().toString()}`;
  performance.mark(`${mark}:start`);
  try {
    return await fn();
  } finally {
    performance.mark(`${mark}:end`);
    try {
      const measure = performance.measure(name, `${mark}:start`, `${mark}:end`);
      if (!IS_DEV) {
        void fetch('/api/telemetry/spans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, durationMs: measure.duration }),
          keepalive: true,
        }).catch(() => undefined);
      } else {
        // eslint-disable-next-line no-console
        console.debug('[telemetry] span', { name, durationMs: measure.duration });
      }
    } catch {
      // Swallow; telemetry must not bubble errors
    }
  }
}

// ── Error reporting ───────────────────────────────────────────────────────────

export interface ErrorContext {
  workspaceId?: string | null;
  correlationId?: string;
  action?: string;
  [key: string]: unknown;
}

/**
 * Report an unexpected error to GlitchTip.
 * The DSN is configured via NEXT_PUBLIC_GLITCHTIP_DSN.
 */
export function reportError(error: Error, context: ErrorContext = {}): void {
  const payload = {
    exception: { type: error.name, value: error.message, stacktrace: error.stack },
    tags: {
      workspace: context.workspaceId ?? 'unknown',
      correlationId: context.correlationId ?? '',
    },
    extra: context,
    timestamp: new Date().toISOString(),
  };

  if (IS_DEV) {
    // eslint-disable-next-line no-console
    console.error('[telemetry] error reported', payload);
    return;
  }

  if (!DSN) return;

  // eslint-disable-next-line promise/no-promise-in-callback
  void fetch(DSN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
