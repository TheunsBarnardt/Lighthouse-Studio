import type { Span, SpanContext, SpanOptions, TracerPort } from '@platform/ports-observability';

class NoopSpan implements Span {
  readonly traceId = crypto.randomUUID();
  readonly spanId = crypto.randomUUID();
  setAttribute(_key: string, _value: string | number | boolean): void {}
  setStatus(_status: 'ok' | 'error', _message?: string): void {}
  end(): void {}
}

export class NoopTracer implements TracerPort {
  startSpan(_name: string, _opts?: SpanOptions): Span {
    return new NoopSpan();
  }
  currentSpan(): Span | null {
    return null;
  }
  inject(_span: Span): Record<string, string> {
    return {};
  }
  extract(_headers: Record<string, string>): SpanContext | null {
    return null;
  }
}
