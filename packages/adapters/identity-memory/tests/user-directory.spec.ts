import { runUserDirectoryConformance } from '@platform/ports-identity/conformance';

import { InMemoryUserDirectory } from '../src/index.js';

runUserDirectoryConformance('InMemoryUserDirectory', () =>
  Promise.resolve(new InMemoryUserDirectory()),
);
