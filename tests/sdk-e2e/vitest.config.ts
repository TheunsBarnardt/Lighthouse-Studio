import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'sdk-e2e',
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 15_000,
    reporters: ['verbose'],
    include: ['tests/sdk-e2e/**/*.test.ts'],
  },
});
