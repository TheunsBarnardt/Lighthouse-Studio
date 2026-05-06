# ADR-0146: Per-Workspace Type Generation via CLI

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 19 (Public SDK)

## Context

Each platform workspace has its own schema — different tables, columns, field types. TypeScript users benefit from types that reflect their specific schema (e.g., `platform.data('users')` returns `{ id: string; email: string; role: 'admin' | 'member' }[]` rather than `Record<string, unknown>[]`). A decision is needed on how to deliver per-workspace types to customers.

## Decision

Types are generated on demand via the CLI command `pdm sync-types --workspace <slug>`. The command fetches the workspace's OpenAPI 3.1 spec from the platform's `/api/v1/data/<workspace>/openapi.json` endpoint and generates TypeScript types using `openapi-typescript`. Output is written to `.platform/types.ts` in the customer's project.

The customer imports the generated types and passes them as a type parameter:

```typescript
import { createClient } from '@platform/sdk';
import type { Database } from './.platform/types';

const platform = createClient<Database>({ url, anonKey });
// platform.data('users') is now typed to Database['users']
```

Types are opt-in. The SDK works with `any` types when `sync-types` has not been run.

## Rationale

- **Reproducibility:** Types can be regenerated at any time from the current schema; they're not stale by construction
- **Offline-capable:** Once generated, types are local files and don't require platform connectivity at build time
- **Non-blocking:** JavaScript users or early-phase TypeScript projects can use the SDK without typed schemas; opt into types when ready
- **Build-time integration:** `pdm sync-types` can be added to `package.json` scripts or CI pre-build hooks

## Consequences

**Easier:**

- No server-side type bundling or distribution infrastructure
- Types accurately reflect the current schema on every `sync-types` run
- CI can run `sync-types` and fail if the committed types are stale

**Harder:**

- Customers must remember to re-run `sync-types` when schemas change (mitigated by `pdm watch`)
- Type generation requires platform connectivity (but not at build time, only at sync time)

**Alternatives considered:**

- **Ship generic types only:** Simpler SDK; rejected — poor DX compared to Supabase which provides per-project types
- **Auto-generate on SDK initialization:** Runtime type generation; rejected — types must be available at compile time for TypeScript inference
- **Server-side type distribution (npm package per workspace):** Too complex; namespace collision risk; rejected
