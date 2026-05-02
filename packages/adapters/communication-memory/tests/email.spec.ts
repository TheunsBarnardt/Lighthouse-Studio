import { runEmailPortConformance } from '@platform/ports-communication/conformance';

import { InMemoryEmailPort } from '../src/index.js';

runEmailPortConformance('InMemoryEmailPort', () => Promise.resolve(new InMemoryEmailPort()));
