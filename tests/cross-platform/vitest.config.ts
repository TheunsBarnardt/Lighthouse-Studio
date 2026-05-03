import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cross-platform',
    include: ['**/*.test.ts'],
    environment: 'node',
  },
});
