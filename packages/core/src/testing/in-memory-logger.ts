import type { LogContext, LoggerPort } from '@platform/ports-observability';

export interface CapturedLogEntry {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  msg: string;
  ctx?: LogContext | undefined;
}

/**
 * In-memory LoggerPort for unit tests.
 *
 * Captures log entries so tests can assert on what was logged. Silently
 * absorbs all output by default. Pass `silent: false` to the factory
 * to also write to console (useful for debugging failing tests).
 */
export function createInMemoryLogger(opts?: { silent?: boolean }): LoggerPort & {
  entries: CapturedLogEntry[];
  reset(): void;
} {
  const silent = opts?.silent ?? true;
  const entries: CapturedLogEntry[] = [];

  function log(level: CapturedLogEntry['level'], msg: string, ctx?: LogContext): void {
    const entry: CapturedLogEntry = { level, msg };
    if (ctx !== undefined) entry.ctx = ctx;
    entries.push(entry);
    if (!silent) {
      // eslint-disable-next-line no-console
      console.log(`[${level.toUpperCase()}] ${msg}`, ctx ?? '');
    }
  }

  const logger: LoggerPort & { entries: CapturedLogEntry[]; reset(): void } = {
    entries,
    reset() {
      entries.length = 0;
    },
    trace: (msg, ctx) => {
      log('trace', msg, ctx);
    },
    debug: (msg, ctx) => {
      log('debug', msg, ctx);
    },
    info: (msg, ctx) => {
      log('info', msg, ctx);
    },
    warn: (msg, ctx) => {
      log('warn', msg, ctx);
    },
    error: (msg, ctx) => {
      log('error', msg, ctx);
    },
    fatal: (msg, ctx) => {
      log('fatal', msg, ctx);
    },
    child: (_ctx: LogContext) => logger,
  };

  return logger;
}
