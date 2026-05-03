import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'accessibility',
    include: ['**/*.a11y.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
  },
});
