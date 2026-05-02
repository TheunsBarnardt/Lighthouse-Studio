import { runLoggerConformance } from '@platform/ports-observability/conformance';

import { NoopLogger } from '../src/index.js';

runLoggerConformance('NoopLogger', () => new NoopLogger());
