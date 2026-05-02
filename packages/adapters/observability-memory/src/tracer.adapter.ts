import type { Span, SpanContext, SpanOptions, TracerPort } from '@platform/ports-observability';

class NoopSpan implements Span {
  readonly traceId = crypto.randomUUID().replace(/-/g, '');
  readonly spanId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  setAttribute(_key: string, _value: string | number | boolean): void {}
  setAttributes(_attrs: Record<string, string | number | boolean>): void {}
  recordException(_error: Error): void {}
  setStatus(_status: 'ok' | 'error', _message?: string): void {}
}

export class NoopTracer implements TracerPort {
  async withSpan<T>(
    _name: string,
    fn: (span: Span) => Promise<T> | T,
    _opts?: SpanOptions,
  ): Promise<T> {
    return fn(new NoopSpan());
  }

  currentSpan(): Span | undefined {
    return undefined;
  }

  extract(_headers: Record<string, string>): SpanContext | undefined {
    return undefined;
  }

  inject(_headers: Record<string, string>): void {}
}
