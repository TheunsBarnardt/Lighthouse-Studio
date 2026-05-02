import { runMetricsConformance } from '@platform/ports-observability/conformance';

import { NoopMetrics } from '../src/index.js';

runMetricsConformance('NoopMetrics', () => new NoopMetrics());
