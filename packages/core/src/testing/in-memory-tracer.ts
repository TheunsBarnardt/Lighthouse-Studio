import type { Span, SpanContext, TracerPort } from '@platform/ports-observability';

class NoopSpan implements Span {
  readonly traceId = '00000000000000000000000000000000';
  readonly spanId = '0000000000000000';
  setAttribute(_key: string, _value: string | number | boolean): void {}
  setAttributes(_attrs: Record<string, string | number | boolean>): void {}
  recordException(_error: Error): void {}
  setStatus(_status: 'ok' | 'error', _message?: string): void {}
}

class NoopTracer implements TracerPort {
  async withSpan<T>(_name: string, fn: (span: Span) => Promise<T> | T): Promise<T> {
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

export function createInMemoryTracer(): TracerPort {
  return new NoopTracer();
}
