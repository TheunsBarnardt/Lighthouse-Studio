import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'leak-tests',
    include: ['**/*.test.ts'],
    environment: 'node',
  },
});
