import { z } from 'zod';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  timestamp?: Date;
}

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricLabels {
  [key: string]: string;
}

export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
  parent?: SpanContext;
}

export interface SpanContext {
  traceId: string;
  spanId: string;
}

export interface Span {
  readonly traceId: string;
  readonly spanId: string;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
  end(): void;
}

export const LogLevelSchema = z.enum(['debug', 'info', 'warn', 'error', 'fatal']);
