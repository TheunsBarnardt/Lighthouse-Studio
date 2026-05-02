import { runTracerConformance } from '@platform/ports-observability/conformance';

import { createOtelTracer } from '../src/index.js';

// No OTLP endpoint — spans are created but not exported
runTracerConformance('OtelTracer', () =>
  createOtelTracer({ serviceName: 'test', serviceVersion: '0.0.0', env: 'test' }),
);
