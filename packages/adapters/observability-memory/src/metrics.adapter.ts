import type { MetricLabels, MetricsPort } from '@platform/ports-observability';

export class NoopMetrics implements MetricsPort {
  increment(_name: string, _value?: number, _labels?: MetricLabels): void {}
  gauge(_name: string, _value: number, _labels?: MetricLabels): void {}
  histogram(_name: string, _value: number, _labels?: MetricLabels): void {}
  timing(_name: string, _durationMs: number, _labels?: MetricLabels): void {}
}
