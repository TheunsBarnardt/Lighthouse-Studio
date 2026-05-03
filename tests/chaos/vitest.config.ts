import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'chaos',
    include: ['**/*.test.ts'],
    environment: 'node',
    // Chaos tests are slow — each scenario can take minutes
    testTimeout: 10 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
    // Run serially: chaos tests inject real failures; concurrent injection is dangerous
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    sequence: { shuffle: false },
  },
});
