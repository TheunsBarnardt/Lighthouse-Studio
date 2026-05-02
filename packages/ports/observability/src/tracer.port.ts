import type { Span, SpanContext, SpanOptions } from './types.js';

export interface TracerPort {
  /**
   * Run a function inside a new span. The span is automatically ended when
   * the function returns (resolved or rejected). Errors are recorded on the span.
   */
  withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T, opts?: SpanOptions): Promise<T>;

  /** Get the current active span, or undefined if there is none. */
  currentSpan(): Span | undefined;

  /**
   * Extract trace context from incoming HTTP headers into a SpanContext.
   * Returns undefined if no valid context is found.
   */
  extract(headers: Record<string, string>): SpanContext | undefined;

  /**
   * Inject the current trace context into the given headers object (mutates it).
   * Used to propagate traces to downstream services.
   */
  inject(headers: Record<string, string>): void;
}

export type { Span, SpanContext };
