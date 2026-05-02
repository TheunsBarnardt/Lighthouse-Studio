import { runJobQueueConformance } from '@platform/ports-jobs/conformance';

import { InMemoryJobQueue } from '../src/index.js';

runJobQueueConformance('InMemoryJobQueue', () => Promise.resolve(new InMemoryJobQueue()));
