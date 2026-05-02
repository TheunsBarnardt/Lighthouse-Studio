import type { Span, SpanContext, SpanOptions, TracerPort } from '@platform/ports-observability';

import {
  context as otelContext,
  propagation,
  SpanStatusCode,
  trace,
  type Span as OtelSpanType,
  type Tracer as OtelTracerType,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  CompositePropagator,
  W3CBaggagePropagator,
  W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { B3InjectEncoding, B3Propagator } from '@opentelemetry/propagator-b3';
import { Resource } from '@opentelemetry/resources';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

class OtelSpanAdapter implements Span {
  readonly traceId: string;
  readonly spanId: string;

  constructor(private readonly inner: OtelSpanType) {
    const ctx = inner.spanContext();
    this.traceId = ctx.traceId;
    this.spanId = ctx.spanId;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.inner.setAttribute(key, value);
  }

  setAttributes(attrs: Record<string, string | number | boolean>): void {
    this.inner.setAttributes(attrs);
  }

  recordException(error: Error): void {
    this.inner.recordException(error);
  }

  setStatus(status: 'ok' | 'error', message?: string): void {
    if (message !== undefined) {
      this.inner.setStatus({
        code: status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
        message,
      });
    } else {
      this.inner.setStatus({
        code: status === 'ok' ? SpanStatusCode.OK : SpanStatusCode.ERROR,
      });
    }
  }
}

export interface OtelTracerOptions {
  /** OTLP HTTP endpoint for the Collector. e.g. http://localhost:4318 */
  otlpEndpoint?: string;
  serviceName: string;
  serviceVersion: string;
  env: string;
}

export class OtelTracer implements TracerPort {
  constructor(private readonly inner: OtelTracerType) {}

  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T> | T,
    opts?: SpanOptions,
  ): Promise<T> {
    const parentCtx = opts?.parent
      ? trace.setSpanContext(otelContext.active(), {
          traceId: opts.parent.traceId,
          spanId: opts.parent.spanId,
          traceFlags: 1,
          isRemote: true,
        })
      : otelContext.active();

    const spanOptions = opts?.attributes !== undefined ? { attributes: opts.attributes } : {};

    return new Promise<T>((resolve, reject) => {
      void this.inner.startActiveSpan(name, spanOptions, parentCtx, async (otelSpan) => {
        const span = new OtelSpanAdapter(otelSpan);
        try {
          const result = await fn(span);
          span.setStatus('ok');
          otelSpan.end();
          resolve(result);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          span.setStatus('error', msg);
          if (error instanceof Error) {
            span.recordException(error);
          }
          otelSpan.end();
          reject(error as Error);
        }
      });
    });
  }

  currentSpan(): Span | undefined {
    const otelSpan = trace.getActiveSpan();
    if (!otelSpan) return undefined;
    return new OtelSpanAdapter(otelSpan);
  }

  extract(headers: Record<string, string>): SpanContext | undefined {
    const ctx = propagation.extract(otelContext.active(), headers);
    const spanCtx = trace.getSpanContext(ctx);
    if (!spanCtx) return undefined;
    return { traceId: spanCtx.traceId, spanId: spanCtx.spanId };
  }

  inject(headers: Record<string, string>): void {
    propagation.inject(otelContext.active(), headers);
  }
}

export function createOtelTracer(opts: OtelTracerOptions): OtelTracer {
  const { otlpEndpoint, serviceName, serviceVersion, env } = opts;

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    'deployment.environment': env,
  });

  const spanProcessors =
    otlpEndpoint !== undefined
      ? [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }))]
      : [];

  const provider = new NodeTracerProvider({
    resource,
    spanProcessors,
  });

  provider.register({
    contextManager: new AsyncLocalStorageContextManager(),
    propagator: new CompositePropagator({
      propagators: [
        new W3CTraceContextPropagator(),
        new W3CBaggagePropagator(),
        new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
      ],
    }),
  });

  return new OtelTracer(provider.getTracer(serviceName, serviceVersion));
}
