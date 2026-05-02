import type {
  Counter,
  Gauge,
  Histogram,
  HistogramOptions,
  MetricAttributes,
  MetricOptions,
  MetricsPort,
} from '@platform/ports-observability';

class NoopCounter implements Counter {
  add(_value: number, _attributes?: MetricAttributes): void {}
}

class NoopGauge implements Gauge {
  set(_value: number, _attributes?: MetricAttributes): void {}
}

class NoopHistogram implements Histogram {
  record(_value: number, _attributes?: MetricAttributes): void {}
}

export class NoopMetrics implements MetricsPort {
  counter(_name: string, _opts?: MetricOptions): Counter {
    return new NoopCounter();
  }
  gauge(_name: string, _opts?: MetricOptions): Gauge {
    return new NoopGauge();
  }
  histogram(_name: string, _opts?: HistogramOptions): Histogram {
    return new NoopHistogram();
  }
}
