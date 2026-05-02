import type { Counter, Gauge, Histogram, HistogramOptions, MetricOptions } from './types.js';

export interface MetricsPort {
  /** Create (or retrieve) a counter. Counters only go up. Name must end in _total. */
  counter(name: string, opts?: MetricOptions): Counter;

  /** Create (or retrieve) a gauge. Gauges can go up and down. */
  gauge(name: string, opts?: MetricOptions): Gauge;

  /** Create (or retrieve) a histogram. Use for durations and sizes. */
  histogram(name: string, opts?: HistogramOptions): Histogram;
}

export type { Counter, Gauge, Histogram };
