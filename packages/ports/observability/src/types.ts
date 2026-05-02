import { z } from 'zod';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

/** Arbitrary structured context attached to a log line. Reserved keys are injected by the adapter. */
export interface LogContext {
  [key: string]: unknown;
  // Reserved: correlationId, traceId, spanId, userId, workspaceId, projectId, err
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp?: Date;
}

// ── Metrics ────────────────────────────────────────────────────────────────

export interface MetricOptions {
  description?: string;
  unit?: string;
}

export interface HistogramOptions extends MetricOptions {
  boundaries?: number[];
}

export type MetricAttributes = Record<string, string | number | boolean>;

export interface Counter {
  add(value: number, attributes?: MetricAttributes): void;
}

export interface Gauge {
  set(value: number, attributes?: MetricAttributes): void;
}

export interface Histogram {
  record(value: number, attributes?: MetricAttributes): void;
}

// ── Tracing ────────────────────────────────────────────────────────────────

export interface SpanContext {
  traceId: string;
  spanId: string;
}

export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
  parent?: SpanContext;
}

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attrs: Record<string, string | number | boolean>): void;
  recordException(error: Error): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
}

// ── Error reporting ────────────────────────────────────────────────────────

export interface ErrorContext {
  user?: { id: string; email?: string };
  workspace?: { id: string };
  project?: { id: string };
  request?: { method: string; url: string; headers?: Record<string, string> };
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

// Legacy aliases kept for internal use in adapters
export type MetricLabels = Record<string, string>;
export type MetricType = 'counter' | 'gauge' | 'histogram';
