import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { runMetricsConformance } from '@platform/ports-observability/conformance';

import { OtelMetrics } from '../src/index.js';

runMetricsConformance(
  'OtelMetrics',
  () => new OtelMetrics(new MeterProvider(), 'test-service', '0.0.0'),
);
