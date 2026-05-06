import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
  target: 'node22',
  platform: 'node',
});
