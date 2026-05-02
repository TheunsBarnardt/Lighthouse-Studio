import { runObjectStorageConformance } from '@platform/ports-storage/conformance';

import { InMemoryObjectStorage } from '../src/index.js';

runObjectStorageConformance('InMemoryObjectStorage', () =>
  Promise.resolve(new InMemoryObjectStorage()),
);
