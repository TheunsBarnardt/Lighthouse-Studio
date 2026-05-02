import { runEventBusConformance } from '@platform/ports-eventing/conformance';

import { InMemoryEventBus } from '../src/index.js';

runEventBusConformance('InMemoryEventBus', () => Promise.resolve(new InMemoryEventBus()));
