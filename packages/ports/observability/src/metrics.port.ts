import type { MetricLabels } from './types.js';

export interface MetricsPort {
  increment(name: string, value?: number, labels?: MetricLabels): void;
  gauge(name: string, value: number, labels?: MetricLabels): void;
  histogram(name: string, value: number, labels?: MetricLabels): void;
  timing(name: string, durationMs: number, labels?: MetricLabels): void;
}
