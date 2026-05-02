import { runSessionConformance } from '@platform/ports-identity/conformance';

import { InMemorySessionAdapter } from '../src/index.js';

runSessionConformance('InMemorySessionAdapter', () =>
  Promise.resolve(new InMemorySessionAdapter()),
);
