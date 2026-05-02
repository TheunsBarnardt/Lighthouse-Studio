import { runRepositoryConformance } from '@platform/ports-persistence/conformance';

import { InMemoryRepository } from '../src/index.js';

interface TestEntity {
  id: string;
  name: string;
  value: number;
}

runRepositoryConformance(
  'InMemoryRepository',
  () => Promise.resolve(new InMemoryRepository<TestEntity>()),
  {
    makeEntity: (overrides?) => ({
      id: crypto.randomUUID(),
      name: 'test entity',
      value: 42,
      ...overrides,
    }),
    makeId: () => crypto.randomUUID(),
  },
);
