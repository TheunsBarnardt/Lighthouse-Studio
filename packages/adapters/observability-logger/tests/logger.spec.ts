import { runLoggerConformance } from '@platform/ports-observability/conformance';

import { createPinoLogger } from '../src/index.js';

// Suppress stdout during tests
runLoggerConformance('PinoLogger', () =>
  createPinoLogger({ level: 'silent', serviceName: 'test', serviceVersion: '0.0.0', env: 'test' }),
);
