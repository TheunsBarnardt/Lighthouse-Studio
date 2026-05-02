# ADR-0003: Adapter Selection via Environment Variables

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform supports three databases (Postgres, MSSQL, MongoDB), multiple identity providers, multiple storage backends, and multiple AI providers. The platform's main differentiator is that customers can choose their backend stack without the platform vendor making that choice for them.

There are several ways to handle adapter selection at runtime:

1. Environment variables (`DATABASE_DRIVER=postgres`)
2. A config file (YAML/JSON/TOML)
3. A database-stored configuration record
4. Compile-time flags

The selection mechanism must work the same way in dev, staging, and prod. It must fail loudly if a customer selects a driver but doesn't provide the required credentials. It must be type-safe so that code consuming the configuration gets the right types.

## Decision

Adapter selection via `*_DRIVER` environment variables, validated at startup by a Zod schema with conditional cross-field validation.

Driver variables:

- `DATABASE_DRIVER`: `postgres | mssql | mongo`
- `IDENTITY_DRIVER`: `builtin | entra | oidc | saml`
- `STORAGE_DRIVER`: `local | s3 | azure_blob`
- `EMAIL_DRIVER`: `smtp | ses | sendgrid`
- `EVENTBUS_DRIVER`: `inproc | redis | postgres`
- `JOBS_DRIVER`: `postgres | mssql | redis`
- `AI_DRIVER`: `claude_cli | anthropic_api | azure_openai`
- `VECTORSTORE_DRIVER`: `pgvector | qdrant | azure_search | inproc`

The schema in `packages/config/src/env/schema.ts` uses `superRefine` to enforce cross-field rules: if `DATABASE_DRIVER=mssql`, then `MSSQL_SERVER` and `MSSQL_DATABASE` are required; if `DATABASE_DRIVER=postgres`, then `POSTGRES_URL` is required; etc.

The composition root (`packages/composition`) reads the driver env vars and instantiates the appropriate adapter for each port.

## Consequences

### Positive

- Driver selection requires no code changes — just env var changes
- The Zod schema is the single source of truth: schema, docs (.env.example), and validation are in sync
- Conditional validation fails fast at startup, not silently at runtime
- Type-safe: `getEnv()` returns a typed object; driver-specific vars are typed correctly
- Customer can switch from Postgres to MSSQL by changing env vars and redeploying

### Negative

- Cross-field validation in Zod's `superRefine` is less discoverable than explicit required fields
- All possible adapter variables exist in the schema simultaneously (even inactive ones) — cosmetically cluttered
- No validation of driver-specific vars until the driver's adapter is instantiated

### Neutral

- The composition root decides which adapter to instantiate; no adapter knows about others
- Capability differences between adapters surface via the capability matrix, not via the env schema

## Alternatives Considered

### Option A: Config file (YAML/TOML)

Pros: Easier to document; supports nested structures.
Cons: Another file to manage; env vars are the standard for containerised apps (12-factor); config files don't benefit from Coolify's secret management.

### Option B: Database-stored configuration

Pros: Can be changed at runtime without restart.
Cons: Creates a chicken-and-egg problem: which database holds the config that tells us which database to use? Also runtime config changes create unpredictable behaviour in multi-tenant platforms.

### Option C: Compile-time adapter selection (build-time flags)

Pros: Smallest bundle (tree-shake unused adapters).
Cons: Requires a new Docker image build to switch adapters. Defeats the purpose of "no code changes to switch backend".

## References

- Objective 2: Environment Strategy (Section 5.6)
- `packages/config/src/env/schema.ts`
- ADR-0005: Hexagonal Architecture
