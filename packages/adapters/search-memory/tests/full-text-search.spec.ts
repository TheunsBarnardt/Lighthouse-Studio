import { runFullTextSearchConformance } from '@platform/ports-search/conformance';

import { InMemoryFullTextSearch } from '../src/index.js';

runFullTextSearchConformance('InMemoryFullTextSearch', () =>
  Promise.resolve(new InMemoryFullTextSearch()),
);
