import type {
  Counter,
  Gauge,
  Histogram,
  HistogramOptions,
  MetricAttributes,
  MetricOptions,
  MetricsPort,
} from '@platform/ports-observability';

import {
  metrics as otelApi,
  type Counter as OtelCounter,
  type Histogram as OtelHistogram,
  type ObservableGauge,
  type ObservableResult,
} from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

class WrappedCounter implements Counter {
  constructor(private readonly otel: OtelCounter) {}
  add(value: number, attributes?: MetricAttributes): void {
    this.otel.add(value, attributes);
  }
}

class WrappedGauge implements Gauge {
  private currentValue = 0;
  private currentAttrs: MetricAttributes | undefined;

  constructor(otelGauge: ObservableGauge) {
    otelGauge.addCallback((result: ObservableResult) => {
      result.observe(this.currentValue, this.currentAttrs);
    });
  }

  set(value: number, attributes?: MetricAttributes): void {
    this.currentValue = value;
    this.currentAttrs = attributes;
  }
}

class WrappedHistogram implements Histogram {
  constructor(private readonly otel: OtelHistogram) {}
  record(value: number, attributes?: MetricAttributes): void {
    this.otel.record(value, attributes);
  }
}

export interface OtelMetricsOptions {
  /** OTLP HTTP endpoint for the Collector. e.g. http://localhost:4318 */
  otlpEndpoint?: string;
  /** Export interval in milliseconds. Defaults to 60_000. */
  exportIntervalMs?: number;
  serviceName: string;
  serviceVersion: string;
  env: string;
}

export class OtelMetrics implements MetricsPort {
  private readonly meter: ReturnType<typeof otelApi.getMeter>;

  constructor(
    private readonly provider: MeterProvider,
    serviceName: string,
    version: string,
  ) {
    this.meter = provider.getMeter(serviceName, version);
  }

  counter(name: string, opts?: MetricOptions): Counter {
    return new WrappedCounter(
      this.meter.createCounter(name, {
        ...(opts?.description !== undefined && { description: opts.description }),
        ...(opts?.unit !== undefined && { unit: opts.unit }),
      }),
    );
  }

  gauge(name: string, opts?: MetricOptions): Gauge {
    const otelGauge = this.meter.createObservableGauge(name, {
      ...(opts?.description !== undefined && { description: opts.description }),
      ...(opts?.unit !== undefined && { unit: opts.unit }),
    });
    return new WrappedGauge(otelGauge);
  }

  histogram(name: string, opts?: HistogramOptions): Histogram {
    return new WrappedHistogram(
      this.meter.createHistogram(name, {
        ...(opts?.description !== undefined && { description: opts.description }),
        ...(opts?.unit !== undefined && { unit: opts.unit }),
        ...(opts?.boundaries !== undefined && {
          advice: { explicitBucketBoundaries: opts.boundaries },
        }),
      }),
    );
  }

  async shutdown(): Promise<void> {
    await this.provider.shutdown();
  }
}

export function createOtelMetrics(opts: OtelMetricsOptions): OtelMetrics {
  const { otlpEndpoint, exportIntervalMs = 60_000, serviceName, serviceVersion, env } = opts;

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    'deployment.environment': env,
  });

  const readers = [];
  if (otlpEndpoint !== undefined) {
    readers.push(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({
          url: `${otlpEndpoint}/v1/metrics`,
        }),
        exportIntervalMillis: exportIntervalMs,
      }),
    );
  }

  const provider = new MeterProvider({ resource, readers });
  otelApi.setGlobalMeterProvider(provider);

  return new OtelMetrics(provider, serviceName, serviceVersion);
}
