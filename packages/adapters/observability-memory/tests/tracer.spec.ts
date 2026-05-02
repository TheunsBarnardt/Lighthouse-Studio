import { runTracerConformance } from '@platform/ports-observability/conformance';

import { NoopTracer } from '../src/index.js';

runTracerConformance('NoopTracer', () => new NoopTracer());
