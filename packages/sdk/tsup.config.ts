import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entry + sub-entries — universal (ESM + CJS)
  {
    entry: {
      index: 'src/index.ts',
      'auth/index': 'src/auth/index.ts',
      'data/index': 'src/data/index.ts',
      'realtime/index': 'src/realtime/index.ts',
      'storage/index': 'src/storage/index.ts',
      'query/index': 'src/query/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: ['ws'],
    esbuildOptions(opts) {
      opts.platform = 'browser';
    },
  },
  // Node-specific entry — uses ws package
  {
    entry: { 'index.node': 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: true,
    define: { __PLATFORM_RUNTIME__: '"node"' },
    esbuildOptions(opts) {
      opts.platform = 'node';
    },
  },
]);
