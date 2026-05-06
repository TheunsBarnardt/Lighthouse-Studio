# ADR-0148: Tree-Shakeable Sub-Exports

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 19 (Public SDK)

## Context

The SDK bundles several large subsystems: auth, data, realtime, storage, query. A customer building a simple read-only app that uses only data queries should not bundle the storage client (which includes tus.io upload logic) or the realtime WebSocket client. The bundle size target for the core SDK is < 30 KB minified-gzipped. Without tree-shaking, the combined size of all subsystems would far exceed this.

## Decision

Each SDK subsystem is published as a separate `package.json` export condition:

```json
{
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./auth": { "import": "./dist/auth/index.js", "types": "./dist/auth/index.d.ts" },
    "./data": { "import": "./dist/data/index.js", "types": "./dist/data/index.d.ts" },
    "./realtime": { "import": "./dist/realtime/index.js", "types": "./dist/realtime/index.d.ts" },
    "./storage": { "import": "./dist/storage/index.js", "types": "./dist/storage/index.d.ts" },
    "./query": { "import": "./dist/query/index.js", "types": "./dist/query/index.d.ts" }
  }
}
```

The full `createClient` import (`.`) composes all subsystems but in a tree-shakeable way — modern bundlers eliminate unused exports from the final bundle. Customers who need strict bundle control can import only `./auth` or `./data` directly.

The tsup build uses `splitting: true` for the universal build so shared transport and error modules are deduplicated across entry points.

A `bundlewatch` check in CI enforces the 30 KB budget on the core entry point and 50 KB on `@platform/sdk-react`.

## Consequences

**Easier:**

- Frontend customers using only auth + data don't pay for realtime or storage
- Bundle size can be precisely measured and budgeted per entry point
- Independent versioning of sub-packages is possible if needed in the future

**Harder:**

- CI must run bundle size checks across multiple entry points
- TypeScript path mapping must be set up correctly for customers using path aliases
- Breaking changes to shared modules (transport, errors) affect all sub-exports

**Alternatives considered:**

- **Single bundled package, no sub-exports:** Simpler build; rejected — exceeds 30 KB budget with all subsystems; doesn't meet the web-first discipline
- **Separate npm packages per subsystem:** Maximum isolation; rejected — dependency management complexity for customers; version coordination overhead
