import type { Span, SpanContext, SpanOptions } from './types.js';

export interface TracerPort {
  startSpan(name: string, opts?: SpanOptions): Span;
  currentSpan(): Span | null;
  inject(span: Span): Record<string, string>;
  extract(headers: Record<string, string>): SpanContext | null;
}
