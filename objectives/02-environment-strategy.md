# Objective 2: Environment Strategy

**Status:** Ready for development
**Prerequisites:** Objective 1 (repo, tooling, CI, branch protection) and Objective 1.5 (abstraction architecture) complete
**Blocks:** Objective 3 (observability needs environments to target), Objective 4 family (database drivers live in environments), and every objective after

---

## 1. Purpose

Establish a self-hosted environment strategy on the customer's infrastructure (the platform's reference deployment is on an Afrihost cloud VPS in South Africa) with reproducible configuration, automated promotion through CI, and zero manual environment setup steps.

The platform must be installable on **any Linux server with Docker** and (separately, in a later phase) on **any Windows Server with IIS**. Today's objective focuses on the Linux/Docker path because that's the maintainer's reference environment. Windows runtime support is _designed for_ (cross-platform Node code, no Linux-isms) but not _deployed_ yet.

The system must be impossible to misconfigure: a wrong key, a missing migration, or a leaked credential should fail loudly and early, never silently in production. This holds whether the customer is the maintainer, a small business, or a Microsoft enterprise.

This objective produces no user-visible features. It produces the deployment, configuration, and recovery substrate that makes every later objective deployable, recoverable, and auditable.

---

## 2. Scope

### In Scope (Linux/Docker Reference Deployment)

- Reference deployment topology on a single Linux VPS (Afrihost)
- Coolify as the deployment orchestrator
- Self-hosted Supabase via Coolify (one of several identity/storage adapter options, NOT a hard platform dependency)
- Caddy as reverse proxy with automatic SSL via Let's Encrypt
- Docker Compose for environment isolation on a single host
- One active environment (dev) initially; staging and prod stacks designed but not provisioned
- Configurable domain via environment variables
- Database driver selection mechanism (chosen via env var: `postgres` | `mssql` | `mongo`)
- Identity provider selection mechanism (chosen via env var: `builtin` | `entra` | `oidc` | `saml`)
- Storage adapter selection (chosen via env var: `local` | `s3` | `azure_blob`)
- Environment variable schema, validation, and management
- Secret rotation strategy
- Promotion pipeline: dev → staging → prod via git (workflows defined; staging/prod jobs gated until provisioned)
- Backup strategy: local + offsite
- Seed data scripts for development
- Environment teardown and rebuild scripts
- Local development setup (one command on Linux, macOS, and Windows)
- Operational runbooks for environment management, secret rotation, backup/restore, domain change
- ADRs documenting environment choices

### Designed-For but Not Yet Deployed

- Windows Server + IIS deployment track (deployment guide written, but not exercised end-to-end until first Windows customer)
- Multi-server clustered deployment (everything is designed cluster-friendly: stateless web app, externalized state, but single-server deployment is the reference)
- Production environment activation (designed; activated when buy-in lands)
- Staging environment activation (designed; activated when buy-in lands)

### Out of Scope (Belongs to Later Objectives)

- Database schema and migrations themselves (Objective 4 family)
- Auth configuration and user management UI (Data Management Module objectives)
- Application code that uses the environments (Objectives 8+)
- Comprehensive backup/disaster recovery procedures (Objective 17 — this objective sets up basic backups)
- Production deployment of the worker (deferred until prod environment is activated)
- Monitoring dashboards and alerting (Objective 3)

---

## 3. Locked Decisions

| Decision                      | Choice                                                                             | Rationale                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Hosting (reference)           | Self-hosted on Afrihost VPS                                                        | Locked from prior turns; no Vercel, no Supabase Cloud                |
| Single server (initial)       | One VPS hosting dev only initially; staging and prod added later                   | Locked from prior turns                                              |
| Server baseline               | 8 GB RAM / 4 vCPU / 100 GB SSD / Ubuntu 24.04 LTS                                  | Comfortable minimum for dev + future small prod                      |
| Server absolute floor         | 4 GB RAM / 2 vCPU / 50 GB SSD / Ubuntu 24.04 LTS                                   | Documented as fallback; AI worker must run locally if used           |
| Orchestrator                  | Coolify (self-hosted PaaS on Docker)                                               | Provides Vercel-like DX on your own server; community-trusted        |
| Reverse proxy                 | Caddy                                                                              | Auto-SSL, simpler config than Traefik; built into Coolify by default |
| Container runtime             | Docker + Docker Compose                                                            | One-server reference; no Kubernetes complexity                       |
| Environment isolation         | Three Docker Compose stacks per env, each with its own network and volumes         | Strong isolation on a single host                                    |
| Database (default)            | Self-hosted Postgres (via the persistence-postgres adapter)                        | Maintainer's stack; default for AGPL OSS distribution                |
| Database (alternatives)       | MSSQL and MongoDB via their respective adapters                                    | Customer's choice via env var; no default change                     |
| Identity (default)            | Built-in auth (the Supabase-clone auth feature, on whatever DB the customer chose) | Locked from prior turns                                              |
| Identity (alternatives)       | Entra ID, generic OIDC, generic SAML                                               | Microsoft houses use these; selected via env var                     |
| Storage (default)             | Local filesystem under a managed volume                                            | Simplest reference; works on any single-server deployment            |
| Storage (alternatives)        | S3-compatible (MinIO, AWS, Backblaze, Wasabi) and Azure Blob                       | Selected via env var                                                 |
| Branch-to-environment mapping | `develop` → dev, `staging` → staging, `main` → prod                                | Convention; promotion is a merge                                     |
| Env var validation            | `@t3-oss/env-core` with zod                                                        | Type-safe, runtime-validated, fails fast on missing/invalid vars     |
| Domain                        | Configurable via env var; not committed                                            | Customer-specific; subdomains derived                                |
| Backup target (reference)     | Backblaze B2 (S3-compatible, very cheap, off-South-Africa)                         | Cheap, reliable, off-site                                            |
| Backup tool                   | Restic (encrypted, deduplicated, supports B2 directly)                             | Industry standard for self-hosted backups                            |
| CI/CD deploy mechanism        | GitHub Actions → SSH → Coolify webhook                                             | Standard Coolify deployment pattern                                  |
| Seed data approach            | Idempotent TypeScript scripts using the persistence port                           | Reproducible, version-controlled, type-safe, database-agnostic       |
| Migration promotion           | Manual approval gates in CI for staging and prod                                   | Prevent accidental destructive migrations                            |

---

## 4. Reference Deployment Topology

### 4.1 The Server (Afrihost VPS)

```
┌─────────────────────────────────────────────────────────────────────┐
│                  Afrihost Cloud VPS — Ubuntu 24.04 LTS              │
│                  8 GB RAM, 4 vCPU, 100 GB SSD                       │
│                  Public IP: x.x.x.x                                 │
│                  Domain: <configurable>.<customer-tld>              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │   Caddy (auto-SSL, reverse proxy)                        │      │
│   │   - dev.<domain>          → web-dev:3000                 │      │
│   │   - studio-dev.<domain>   → coolify-studio (admin only)  │      │
│   │   - supabase-dev.<domain> → supabase-kong-dev:8000       │      │
│   │                                                           │      │
│   │   (staging.* and apex domain reserved, not yet routed)   │      │
│   └────────────────────────┬─────────────────────────────────┘      │
│                            │                                         │
│   ┌────────────────────────▼─────────────────────────────────┐      │
│   │   Coolify (orchestration, runs as Docker stack)           │     │
│   │                                                           │      │
│   │   ┌───────────────────┐  ┌───────────────────┐           │      │
│   │   │  Stack: Dev       │  │  Stack: Staging   │ (dormant) │      │
│   │   │  ───────────────  │  │  ───────────────  │           │      │
│   │   │  - web-dev        │  │  (designed,       │           │      │
│   │   │  - worker-dev*    │  │   not deployed)   │           │      │
│   │   │  - postgres-dev   │  │                   │           │      │
│   │   │  - supabase-dev** │  │                   │           │      │
│   │   │  - storage-dev    │  │                   │           │      │
│   │   │  - redis-dev      │  │                   │           │      │
│   │   └───────────────────┘  └───────────────────┘           │      │
│   │                                                           │      │
│   │   ┌───────────────────┐                                   │      │
│   │   │  Stack: Prod      │ (dormant)                         │      │
│   │   │  ───────────────  │                                   │      │
│   │   │  (designed,       │                                   │      │
│   │   │   not deployed)   │                                   │      │
│   │   └───────────────────┘                                   │      │
│   └───────────────────────────────────────────────────────────┘     │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐     │
│   │   Backups (Restic to Backblaze B2, encrypted)             │     │
│   │   - Daily: postgres dump, storage volumes, env files      │     │
│   │   - Weekly: full system snapshot                          │     │
│   └───────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘

* worker-dev runs locally on the maintainer's machine for now (Claude
  Code CLI on Max plan); this container slot exists for when it moves
  to the server.

** supabase-dev is a self-hosted Supabase stack. The platform talks
   to it through the `identity-supabase` adapter and the `storage-s3`
   adapter (Supabase storage exposes S3-compatible API). It is one
   identity/storage option among several, selectable via env var.
   For an MSSQL customer, this entire sub-stack is replaced with their
   chosen identity provider and storage backend.
```

### 4.2 Critical Isolation Rule

No environment ever shares credentials, databases, or storage with another. Each Docker Compose stack has:

- Its own Docker network
- Its own database container (or external connection string)
- Its own volumes for data and storage
- Its own env file with environment-specific secrets
- Its own subdomain

A leak in dev does not touch staging or prod. A backup of dev cannot be restored to prod (different secrets, different keys).

### 4.3 Subdomain Plan (Configurable)

Given a configured base domain `<DOMAIN>` (e.g., `platform.example.co.za`):

| Environment   | Web App            | Supabase / Studio (dev only) | Status                 |
| ------------- | ------------------ | ---------------------------- | ---------------------- |
| dev           | `dev.<DOMAIN>`     | `supabase-dev.<DOMAIN>`      | Active                 |
| staging       | `staging.<DOMAIN>` | `supabase-staging.<DOMAIN>`  | Reserved               |
| prod          | `<DOMAIN>` (apex)  | `supabase.<DOMAIN>`          | Reserved               |
| Coolify admin | `coolify.<DOMAIN>` | n/a                          | Active (IP-restricted) |

If the customer chooses a different identity/storage provider (e.g., Entra ID + Azure Blob), Supabase subdomains are not used.

---

## 5. Component Specifications

### 5.1 Server Provisioning

**One-time initial setup of the Afrihost VPS:**

1. Provision Ubuntu 24.04 LTS, 8 GB / 4 vCPU / 100 GB
2. Set up SSH key-based auth (passwords disabled)
3. Create a non-root sudo user; SSH disabled for root
4. Install fail2ban, ufw, unattended-upgrades
5. UFW rules: allow 22 (SSH, IP-restricted to maintainer IPs), 80, 443. Deny everything else.
6. Set hostname, timezone (Africa/Johannesburg by default; configurable), NTP sync
7. Install Docker Engine + Docker Compose v2 from Docker's official repo
8. Install Coolify per its installation instructions
9. Configure Coolify with admin credentials (stored in maintainer's password manager)
10. Verify Caddy (bundled with Coolify) is up and serving on 80/443

**Document this in `docs/runbooks/server-provisioning.md`** as a step-by-step. Every command. Every verification. Future-you, when provisioning a second server, will need this.

### 5.2 Coolify Configuration

Coolify provides Vercel-like deploy-from-git for self-hosted. Configure:

- **Source:** the GitHub repository
- **Auto-deploy:** disabled by default; CI controls deploys via Coolify webhooks instead
- **Resources:**
  - One **Project** in Coolify representing this installation
  - Three **Resources** within: dev, staging, prod (only dev's resource is active initially; staging and prod are configured but disabled until provisioned)
- **Build:** Dockerfile-based for the web app and worker; managed services (Postgres, Redis, Supabase) deployed from Coolify's service catalog with custom configuration

### 5.3 Docker Compose Stacks

The platform's repo contains, under `deploy/compose/`:

- `dev.yml` — the active dev stack
- `staging.yml` — designed; brought up when staging is activated
- `prod.yml` — designed; brought up when prod is activated
- `shared/` — reusable Compose fragments

Each stack defines:

- Web app container (Next.js standalone build)
- Worker container (Node, runs the AI gateway worker; may be disabled in dev if running locally)
- Postgres container (with volume) — only used if the customer chose Postgres
- (Optional) MSSQL container — used if the customer chose MSSQL
- (Optional) Mongo container — used if the customer chose Mongo
- Redis container (for jobs and event bus)
- Supabase services (only if the customer chose `identity-supabase`):
  - GoTrue, PostgREST, Realtime, Storage API, Studio, Kong gateway
- Backup sidecar (Restic, runs on cron)

**Container naming convention:** `<service>-<env>` (e.g., `web-dev`, `postgres-dev`).

**Network naming:** `platform-<env>` (e.g., `platform-dev`).

**Volume naming:** `platform-<service>-<env>-data` (e.g., `platform-postgres-dev-data`).

These names ensure no accidental cross-environment connections even if Compose is run from the wrong directory.

### 5.4 Caddy Configuration

Coolify generates Caddy config from the resource configuration. For the platform's specific subdomain pattern, an override file `deploy/caddy/Caddyfile.platform` is loaded:

```
{
  email {$ADMIN_EMAIL}
}

dev.{$DOMAIN} {
  reverse_proxy web-dev:3000
  encode zstd gzip
  log {
    output file /var/log/caddy/dev-access.log
  }
}

# Studio for self-hosted Supabase, dev only — IP-restricted
supabase-dev.{$DOMAIN} {
  @allowed remote_ip {$ADMIN_ALLOWED_IPS}
  handle @allowed {
    reverse_proxy supabase-kong-dev:8000
  }
  handle {
    respond "Forbidden" 403
  }
}

# Coolify admin UI — IP-restricted
coolify.{$DOMAIN} {
  @allowed remote_ip {$ADMIN_ALLOWED_IPS}
  handle @allowed {
    reverse_proxy localhost:8000
  }
  handle {
    respond "Forbidden" 403
  }
}

# staging.* and apex reserved — return 503 until activated
staging.{$DOMAIN}, {$DOMAIN}, www.{$DOMAIN} {
  respond "Coming soon" 503
}
```

The `{$VAR}` substitutions come from the env file Coolify renders.

### 5.5 Worker Deployment Strategy

**Phase 1 (now):** Worker runs on the maintainer's local machine.

- Configured via local `.env.local` to point at the dev environment over the internet
- The worker connects to the Postgres database (or chosen DB) via TLS over the public network
- Worker uses `pm2` for resilience (auto-restart on crash, log rotation)
- Worker uses Claude Code CLI for AI generation (Max plan, no per-token cost)

**Phase 2 (when prod activates or worker moves to server):**

- Worker becomes a container in the relevant Compose stack
- Reads the same env vars as before (no code changes)
- Logs go to stdout, captured by Docker
- Health check exposed on `/health`
- Multiple worker instances supported via Compose `replicas`

The worker's portability constraints (laid down in Objective 1.5):

- Reads config from environment variables only
- Uses `Path` utilities from `@platform/shared` (no Linux-isms)
- Process management via `tsx`/`node`, no shell scripts
- This means it runs on Windows Server too, when the time comes

### 5.6 Environment Variable Schema

**Single source of truth: `packages/config/src/env/schema.ts`**

Every environment variable the platform uses, validated with zod, separated by surface (server-only, client-exposed) and by concern (which adapter it configures).

```typescript
// packages/config/src/env/schema.ts
import { z } from 'zod';

// ========== CLIENT-EXPOSED ==========
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_BRAND_NAME: z.string().default('Platform'),
});

// ========== SERVER-ONLY (FOUNDATION) ==========
const foundationEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production']),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  PORT: z.coerce.number().int().positive().default(3000),
  DOMAIN: z.string(),
  ADMIN_EMAIL: z.string().email(),
});

// ========== ADAPTER SELECTION ==========
const adapterSelectionSchema = z.object({
  DATABASE_DRIVER: z.enum(['postgres', 'mssql', 'mongo']).default('postgres'),
  IDENTITY_DRIVER: z.enum(['builtin', 'entra', 'oidc', 'saml']).default('builtin'),
  STORAGE_DRIVER: z.enum(['local', 's3', 'azure_blob']).default('local'),
  EMAIL_DRIVER: z.enum(['smtp', 'ses', 'sendgrid']).default('smtp'),
  EVENTBUS_DRIVER: z.enum(['inproc', 'redis', 'postgres']).default('redis'),
  JOBS_DRIVER: z.enum(['postgres', 'mssql', 'redis']).default('postgres'),
  AI_DRIVER: z.enum(['claude_cli', 'anthropic_api', 'azure_openai']).default('claude_cli'),
  VECTORSTORE_DRIVER: z.enum(['pgvector', 'qdrant', 'azure_search', 'inproc']).default('pgvector'),
});

// ========== POSTGRES ADAPTER ==========
const postgresEnvSchema = z.object({
  POSTGRES_URL: z.string().url(),
  POSTGRES_DIRECT_URL: z.string().url().optional(), // bypasses pgbouncer for migrations
  POSTGRES_POOL_SIZE: z.coerce.number().int().positive().default(10),
});

// ========== MSSQL ADAPTER ==========
const mssqlEnvSchema = z.object({
  MSSQL_SERVER: z.string().optional(),
  MSSQL_PORT: z.coerce.number().int().positive().default(1433),
  MSSQL_DATABASE: z.string().optional(),
  MSSQL_USER: z.string().optional(),
  MSSQL_PASSWORD: z.string().optional(),
  MSSQL_ENCRYPT: z.coerce.boolean().default(true),
});

// ========== MONGO ADAPTER ==========
const mongoEnvSchema = z.object({
  MONGO_URL: z.string().url().optional(),
  MONGO_DATABASE: z.string().optional(),
});

// ========== IDENTITY (BUILTIN) ==========
const identityBuiltinSchema = z.object({
  AUTH_SECRET: z.string().min(32),
  AUTH_SESSION_DURATION_DAYS: z.coerce.number().int().positive().default(30),
});

// ========== IDENTITY (ENTRA / OIDC / SAML) ==========
const identityEnterpriseSchema = z.object({
  OIDC_ISSUER_URL: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  SAML_METADATA_URL: z.string().url().optional(),
  SAML_CERT: z.string().optional(),
});

// ========== STORAGE (LOCAL) ==========
const storageLocalSchema = z.object({
  STORAGE_LOCAL_PATH: z.string().default('/var/platform/storage'),
});

// ========== STORAGE (S3) ==========
const storageS3Schema = z.object({
  STORAGE_S3_ENDPOINT: z.string().url().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_ACCESS_KEY: z.string().optional(),
  STORAGE_S3_SECRET_KEY: z.string().optional(),
  STORAGE_S3_PATH_STYLE: z.coerce.boolean().default(false),
});

// ========== STORAGE (AZURE BLOB) ==========
const storageAzureSchema = z.object({
  STORAGE_AZURE_ACCOUNT: z.string().optional(),
  STORAGE_AZURE_KEY: z.string().optional(),
  STORAGE_AZURE_CONTAINER: z.string().optional(),
});

// ========== EMAIL ==========
const emailSchema = z.object({
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SES_REGION: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
});

// ========== AI / WORKER ==========
const aiWorkerSchema = z.object({
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  WORKER_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
  WORKER_MAX_CONCURRENCY: z.coerce.number().int().positive().default(1),
  CLAUDE_CLI_PATH: z.string().default('claude'),
  CLAUDE_CLI_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  ANTHROPIC_API_KEY: z.string().optional(),
  AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
  AZURE_OPENAI_KEY: z.string().optional(),
});

// ========== REDIS ==========
const redisSchema = z.object({
  REDIS_URL: z.string().url().optional(),
});

// ========== COMPOSED ==========
export const serverEnvSchema = foundationEnvSchema
  .merge(adapterSelectionSchema)
  .merge(postgresEnvSchema.partial())
  .merge(mssqlEnvSchema.partial())
  .merge(mongoEnvSchema.partial())
  .merge(identityBuiltinSchema.partial())
  .merge(identityEnterpriseSchema.partial())
  .merge(storageLocalSchema.partial())
  .merge(storageS3Schema.partial())
  .merge(storageAzureSchema.partial())
  .merge(emailSchema.partial())
  .merge(aiWorkerSchema.partial())
  .merge(redisSchema.partial())
  .superRefine((v, ctx) => {
    // Cross-field validation: required fields based on driver selection
    if (v.DATABASE_DRIVER === 'postgres' && !v.POSTGRES_URL) {
      ctx.addIssue({ code: 'custom', message: 'POSTGRES_URL is required when DATABASE_DRIVER=postgres' });
    }
    if (v.DATABASE_DRIVER === 'mssql' && (!v.MSSQL_SERVER || !v.MSSQL_DATABASE)) {
      ctx.addIssue({ code: 'custom', message: 'MSSQL_SERVER and MSSQL_DATABASE are required when DATABASE_DRIVER=mssql' });
    }
    if (v.DATABASE_DRIVER === 'mongo' && !v.MONGO_URL) {
      ctx.addIssue({ code: 'custom', message: 'MONGO_URL is required when DATABASE_DRIVER=mongo' });
    }
    if (v.IDENTITY_DRIVER === 'builtin' && !v.AUTH_SECRET) {
      ctx.addIssue({ code: 'custom', message: 'AUTH_SECRET is required when IDENTITY_DRIVER=builtin' });
    }
    if (v.IDENTITY_DRIVER === 'oidc' && (!v.OIDC_ISSUER_URL || !v.OIDC_CLIENT_ID)) {
      ctx.addIssue({ code: 'custom', message: 'OIDC_ISSUER_URL and OIDC_CLIENT_ID are required when IDENTITY_DRIVER=oidc' });
    }
    // ... more cross-field checks
  });

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
```

The conditional validation is what makes the platform robust: a customer with `DATABASE_DRIVER=mssql` doesn't need to set `POSTGRES_URL`, and the schema enforces that they do set the MSSQL vars.

**Validated accessor: `packages/config/src/env/index.ts`** — uses `@t3-oss/env-nextjs` for the web app, `@t3-oss/env-core` for the worker. Both wrap the schema and produce a typed `env` object.

**ESLint rules** (from Objective 1) block direct `process.env` access outside this package.

### 5.7 `.env.example`

A complete documented template at the repo root. Every variable. Every section commented. Used by:

- New contributors copying to `.env.local`
- The CI `env-completeness` check (verifies schema and example are in sync)
- Documentation

```bash
# ===================================================================
# PLATFORM ENVIRONMENT CONFIGURATION
# Copy to .env.local and fill in. Never commit .env.local.
# ===================================================================

# --- Foundation ---
APP_ENV="development"                       # development | staging | production
NODE_ENV="development"
LOG_LEVEL="debug"
PORT="3000"
DOMAIN="dev.platform.example.co.za"
ADMIN_EMAIL="admin@example.co.za"

# --- Client-exposed ---
NEXT_PUBLIC_APP_ENV="development"
NEXT_PUBLIC_APP_URL="https://dev.platform.example.co.za"
NEXT_PUBLIC_BRAND_NAME="Platform"

# --- Adapter Selection ---
DATABASE_DRIVER="postgres"                  # postgres | mssql | mongo
IDENTITY_DRIVER="builtin"                   # builtin | entra | oidc | saml
STORAGE_DRIVER="local"                      # local | s3 | azure_blob
EMAIL_DRIVER="smtp"                         # smtp | ses | sendgrid
EVENTBUS_DRIVER="redis"                     # inproc | redis | postgres
JOBS_DRIVER="postgres"                      # postgres | mssql | redis
AI_DRIVER="claude_cli"                      # claude_cli | anthropic_api | azure_openai
VECTORSTORE_DRIVER="pgvector"               # pgvector | qdrant | azure_search | inproc

# --- Postgres (only if DATABASE_DRIVER=postgres) ---
POSTGRES_URL="postgres://user:pass@postgres-dev:5432/platform"
POSTGRES_DIRECT_URL="postgres://user:pass@postgres-dev:5432/platform"
POSTGRES_POOL_SIZE="10"

# --- MSSQL (only if DATABASE_DRIVER=mssql) ---
# MSSQL_SERVER=""
# MSSQL_PORT="1433"
# MSSQL_DATABASE=""
# MSSQL_USER=""
# MSSQL_PASSWORD=""
# MSSQL_ENCRYPT="true"

# --- Mongo (only if DATABASE_DRIVER=mongo) ---
# MONGO_URL=""
# MONGO_DATABASE=""

# --- Identity (built-in) ---
AUTH_SECRET="<generate with: openssl rand -base64 48>"
AUTH_SESSION_DURATION_DAYS="30"

# --- Identity (OIDC / Entra) ---
# OIDC_ISSUER_URL=""
# OIDC_CLIENT_ID=""
# OIDC_CLIENT_SECRET=""
# OIDC_REDIRECT_URI=""

# --- Storage (local) ---
STORAGE_LOCAL_PATH="/var/platform/storage"

# --- Storage (S3) ---
# STORAGE_S3_ENDPOINT=""
# STORAGE_S3_REGION=""
# STORAGE_S3_BUCKET=""
# STORAGE_S3_ACCESS_KEY=""
# STORAGE_S3_SECRET_KEY=""

# --- Email ---
EMAIL_FROM="noreply@example.co.za"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_SECURE="false"

# --- AI / Worker ---
WORKER_POLL_INTERVAL_MS="2000"
WORKER_JOB_TIMEOUT_MS="300000"
WORKER_MAX_CONCURRENCY="1"
CLAUDE_CLI_PATH="claude"
CLAUDE_CLI_TIMEOUT_MS="120000"

# --- Redis ---
REDIS_URL="redis://redis-dev:6379"
```

### 5.8 Secret Distribution

**Where each value lives:**

| Variable Type                  | Local Dev    | Coolify (per stack)                 | Backup Encrypted |
| ------------------------------ | ------------ | ----------------------------------- | ---------------- |
| `NEXT_PUBLIC_*`                | `.env.local` | Coolify env (env-scoped)            | n/a (public)     |
| `AUTH_SECRET`                  | `.env.local` | Coolify env (env-scoped, sensitive) | Yes              |
| `POSTGRES_URL` (with password) | `.env.local` | Coolify env (env-scoped, sensitive) | Yes              |
| Storage credentials            | `.env.local` | Coolify env (env-scoped, sensitive) | Yes              |
| SMTP credentials               | `.env.local` | Coolify env (env-scoped, sensitive) | Yes              |

**Protections:**

- `.env.local` and all `.env*` (except `.env.example`) are gitignored
- Pre-commit hook runs `gitleaks` on staged changes
- CI runs `gitleaks` on the diff
- Coolify env vars marked sensitive are write-only after creation
- Server file-system permissions on env files: 0600, owned by the Coolify service account
- Restic backups are encrypted; the encryption passphrase is stored only in the maintainer's password manager and a printed offline copy in a sealed envelope (or equivalent recovery mechanism)

### 5.9 Local Development Setup

`scripts/setup-local.mts` — a TypeScript script (run via `tsx`) that:

1. Verifies Node version matches `.nvmrc`
2. Verifies pnpm version
3. Installs dependencies via `pnpm install --frozen-lockfile`
4. Checks for `.env.local`; if missing, copies `.env.example` and prompts for required values (or notes that the developer should fill it in manually)
5. Validates the env file by importing the schema and running validation
6. Detects platform (Linux, macOS, Windows) and prints any platform-specific notes (e.g., "On Windows, use Git Bash for shell scripts")
7. If on Linux/macOS, optionally offers to start a local Postgres + Redis via `docker compose -f deploy/compose/local.yml up -d` for offline development
8. Runs `pnpm db:generate` (placeholder until Objective 4 lands)
9. Runs `pnpm seed:dev` if local db is empty (placeholder until Objective 4 lands)
10. Prints clear next steps

`pnpm setup` runs this script. Idempotent — safe to run multiple times.

**Local dev modes:**

- **Online mode:** developer machine connects to dev environment on Afrihost (default)
- **Offline mode:** developer brings up a local Compose stack mirroring dev (useful for travel, demos, debugging)

Both modes are documented; both are tested.

### 5.10 Promotion Pipeline (CI)

Extends the CI from Objective 1 with deployment.

**On merge to `develop`:**

- Standard PR checks (already required to merge)
- Build and push Docker image to a registry (GitHub Container Registry — free, public for public repos)
- Trigger Coolify webhook to redeploy the dev stack
- Smoke test: hit `/health` on the new deployment, fail the workflow if unhealthy

**On merge to `staging`:**

- Standard checks
- Build and push image
- **Manual approval gate** in GitHub Actions Environment `staging` (only authorized reviewers can approve)
- Run staging migration (when migration system exists in Objective 4)
- Trigger Coolify webhook for staging stack

**On merge to `main`:**

- Standard checks
- Build and push image
- **Manual approval gate** in GitHub Actions Environment `prod`
- Wait timer (5 minutes) for last-minute aborts
- Run prod migration (gated, requires successful staging migration in the previous run)
- Trigger Coolify webhook for prod stack

**GitHub Actions Environments to configure:**

- `dev` — no protection
- `staging` — required reviewers (you, for now); scoped secrets `COOLIFY_STAGING_WEBHOOK`, `STAGING_SSH_KEY` etc.
- `prod` — required reviewers (you); 5-minute wait timer; scoped secrets

These environments hold scoped secrets so a compromise of the dev workflow can never expose prod credentials.

**`.github/workflows/promote.yml`** — separate workflow file dedicated to deployment.

### 5.11 Backup Strategy

**Restic configuration:**

- Repository: Backblaze B2 bucket (encrypted at rest by Restic; B2 is also encrypted at rest by Backblaze)
- Encryption passphrase: stored in maintainer's password manager + printed offline copy
- Bucket lifecycle: keep daily backups for 30 days, weekly for 12 weeks, monthly for 12 months

**What gets backed up:**

- Postgres database: `pg_dump` to a local volume, then Restic backs up that file
- Storage volumes (file uploads, Supabase storage if used)
- Env files (encrypted; not the only copy of secrets, but useful for full recovery)
- Coolify configuration (also stored in git/Coolify itself, so this is belt-and-braces)

**What does NOT get backed up:**

- Anything in dev (it's reproducible from seed scripts; backup overhead not worth it). Optional: enable later if dev data becomes valuable.
- Container images (rebuildable from git)
- Application code (it's in git)

**Schedule (when prod activates):**

- Daily: incremental, runs at 03:00 SAST
- Weekly: full snapshot, runs Sunday 04:00 SAST
- Monthly: explicit prune + integrity check

**Today (dev only):** backups configured but optional. Restic repo created, encryption passphrase stored, scripts written, schedule disabled until prod activates. The infrastructure exists from day one; turning it on is one config change.

**Restore drills:** quarterly. Documented in `docs/runbooks/disaster-recovery.md`.

### 5.12 Seed Data

`packages/db/seed/` (skeleton in this objective; populated in Objective 4):

- `dev.ts` — populates dev with realistic fixtures: workspace, members, projects, sample artifacts. Idempotent. Uses the `RepositoryPort` abstractions, so it works on any database adapter.
- `staging.ts` — populates staging with anonymized realistic data. Idempotent.
- `prod.ts` — exists but only creates structural rows (e.g., default roles). Never creates user data. Requires `--confirm` flag.

Run via `pnpm seed:dev`, `pnpm seed:staging`, `pnpm seed:prod`. The prod variant requires explicit confirmation to prevent accidents.

The seed scripts are database-agnostic — they go through the persistence ports, which means seeding works whether the customer is on Postgres, MSSQL, or Mongo.

### 5.13 Teardown and Rebuild

`pnpm db:reset:dev` — wipes the dev database, runs migrations from scratch, re-seeds. Used when the schema is in flux during early development. Requires confirmation prompt.

**Never** offer this for staging or prod. Resetting those is a manual procedure documented in the runbook.

### 5.14 Environment Health & Visibility

A diagnostic page at `/_status` (server-rendered):

- Reports `APP_ENV`, build SHA, build time, app version
- Verifies database connectivity (any driver)
- Verifies storage adapter reachable (any driver)
- Verifies email adapter reachable (any driver)
- Verifies job queue reachable
- Verifies AI adapter health (does NOT make a real AI call; just checks the adapter is configured)
- Returns no secrets, ever

Access control:

- Dev: open
- Staging/prod: requires service-role auth (the platform's admin auth, established later in the Data Management Module objectives)

This is invaluable for debugging "is this env wired up correctly" questions across all the swappable adapters.

### 5.15 Operational Runbooks

New files in `docs/runbooks/`:

- **`server-provisioning.md`** — step-by-step initial Afrihost VPS setup
- **`environments.md`** — overview of dev/staging/prod, URLs, who has access, how to switch the worker between them, how to switch adapter drivers
- **`secret-rotation.md`** — rotating AUTH_SECRET, database passwords, S3 keys, Coolify access tokens; including order of operations to avoid downtime
- **`provisioning-staging.md`** — when buy-in lands, exact steps to bring up the staging stack
- **`provisioning-prod.md`** — when buy-in lands, exact steps to bring up the prod stack
- **`backup-and-restore.md`** — Restic operations, restore drill procedure, where the encryption passphrase lives
- **`disaster-recovery.md`** — full server loss procedure: provision new VPS, restore Restic, point DNS, verify
- **`domain-change.md`** — procedure for changing the configured domain
- **`adapter-switching.md`** — procedure for switching, e.g., from `local` storage to `s3`
- **`windows-deployment.md`** — Windows Server + IIS deployment guide (designed for, not exercised; will be tested when first Windows customer engages)

Runbooks are written **now**, while the steps are fresh, even if they're not all used yet.

---

## 6. Implementation Order

1. **Provision the Afrihost VPS** with the security baseline from Section 5.1
2. **Install Coolify** and verify Caddy is serving
3. **Configure DNS** for the chosen domain: A record for the apex pointing to the server IP; wildcard A record for subdomains
4. **Decide on initial adapter selection:** Postgres + builtin auth + local storage + SMTP. The simplest config to bring up dev.
5. **Write `packages/config/src/env/schema.ts`** with the full schema and conditional validation
6. **Write `.env.example`** with all variables documented
7. **Write `packages/config/src/env/index.ts`** with t3-env validated accessor
8. **Add ESLint rules** blocking raw `process.env` access (already in Objective 1, verify)
9. **Write `scripts/setup-local.mts`** for one-command setup
10. **Create `deploy/compose/dev.yml`** for the dev stack (Postgres + Redis + web + worker stub + Caddy override)
11. **Create `deploy/compose/staging.yml` and `deploy/compose/prod.yml`** as designed-but-disabled
12. **Create `deploy/caddy/Caddyfile.platform`** with the routing
13. **Wire up Coolify** to deploy the dev stack from the `develop` branch
14. **Create GitHub Actions Environments** (`dev`, `staging`, `prod`) with appropriate protection
15. **Add `.github/workflows/promote.yml`** with deploy jobs to dev (active) and stubs for staging/prod
16. **Set up GitHub Container Registry** access tokens (in Coolify and CI)
17. **Add the `gitleaks` check** to pre-commit and CI (already in Objective 1)
18. **Add the env-completeness check** to CI: verifies `.env.example` and the zod schema are in sync
19. **Add the `/_status` route** as a stub (full impl as features land in later objectives)
20. **Set up Restic on the server**, configured for B2, encryption passphrase stored, scripts ready, schedule disabled for dev
21. **Write all runbooks** in Section 5.15
22. **Write ADRs** documenting environment strategy, adapter selection mechanism, secret management, license choice, backup strategy
23. **Verify all DoD checkboxes** in Section 9

---

## 7. ADRs to Write

- **ADR-0002: Environment Strategy** — three environments, branch mapping, single-server reference deployment, isolation via Docker Compose stacks, why not Vercel
- **ADR-0003: Adapter Selection via Environment Variables** — driver names, conditional schema validation, capability discovery
- **ADR-0004: License Choice (AGPL-3.0)** — protection, contributor implications, dual-licensing optionality
- **ADR-0015: Secret Management** — Coolify env vars + local `.env.local`, validated via t3-env, no third-party secret manager initially
- **ADR-0016: Backup Strategy** — Restic to Backblaze B2, retention, restore drills
- **ADR-0017: Self-Hosted Coolify as Orchestrator** — why Coolify, what we give up vs. K8s, what we gain vs. raw Docker

(Numbering picks up from the ADRs in Objectives 1 and 1.5; adjust as needed.)

---

## 8. Verification Steps

1. **Server is hardened.** SSH password auth disabled, fail2ban active, ufw enabled, only 22/80/443 open, root SSH disabled.

2. **Coolify is up.** Admin UI reachable at `coolify.<domain>` (IP-restricted), credentials stored.

3. **Dev stack deploys cleanly.** Push to `develop`, GitHub Actions builds image, pushes to GHCR, triggers Coolify webhook, Coolify pulls and restarts containers, smoke test passes. Total time under 5 minutes.

4. **Env validation fails loudly.** Remove `POSTGRES_URL` from the dev env. Trigger a redeploy. Container fails to start with a clear error naming the missing var. Restore. Redeploy. Works.

5. **Adapter selection works.** In a test branch, change `DATABASE_DRIVER` to `mongo` (without setting Mongo vars). Schema validation fails on startup. Add Mongo vars. Validation passes (even though no Mongo is reachable; that's a runtime error, not a config error). This proves the conditional validation works.

6. **Cross-environment isolation.** A leak of dev's `AUTH_SECRET` cannot decrypt staging or prod sessions (different secrets per env, even if those envs aren't deployed yet — secrets are pre-generated for staging/prod and stored in Coolify).

7. **Branch protection blocks accidental promotion.** Try to push directly to `staging`. Blocked. Try to merge a PR targeting `staging` without environment approval. Blocked.

8. **Onboarding test.** On a clean machine (Linux, macOS, and Windows separately), run `pnpm setup`. Follow the prompts. The platform runs locally end-to-end (offline mode for Windows). Total time under 30 minutes.

9. **Secret leak prevention.** Try to commit a secret. Pre-commit `gitleaks` blocks. Try `--no-verify`. Push. CI `gitleaks` blocks. Cannot reach `main`.

10. **Public/server boundary.** Try to import a server-only env var in a client component. ESLint blocks. Try to import a `NEXT_PUBLIC_` var that doesn't exist. TypeScript blocks.

11. **Status page.** Visit `/_status` on dev. Returns env name, build info, adapter health checks. No secrets. On staging/prod (when activated), requires admin auth.

12. **Caddy auto-SSL.** Wait for first deploy; certificate is issued automatically by Let's Encrypt. SSL Labs grade A or higher.

13. **Backup configuration.** Restic repo initialized, encryption passphrase tested by listing snapshots, schedule defined but disabled for dev. Confirm the passphrase works by doing a dry-run restore.

14. **Caddy IP restrictions work.** Try to access `coolify.<domain>` or `supabase-dev.<domain>` from an unauthorized IP. 403. From an authorized IP. 200.

15. **Promotion path test.** Make a trivial change. PR to `develop`. CI passes. Merge. Coolify auto-deploys to dev. Verify on `dev.<domain>`. (Staging and prod paths exist in CI but are disabled until activated.)

16. **Runbook test.** Follow `docs/runbooks/server-provisioning.md` mentally (or actually, on a throwaway VPS) to provision a second server. Note any gaps. Fix them.

If all 16 pass, the objective is met.

---

## 9. Definition of Done

**Server**

- [ ] Afrihost VPS provisioned, hardened, documented in runbook
- [ ] Coolify installed and accessible via IP-restricted subdomain
- [ ] Caddy serving the configured domain with auto-SSL
- [ ] DNS configured: apex + wildcard subdomain to the server IP
- [ ] UFW firewall rules: 22 (IP-restricted), 80, 443 only
- [ ] fail2ban + unattended-upgrades active
- [ ] Restic configured with B2 backend (schedule disabled for dev, ready for prod)

**Environments**

- [ ] Dev Compose stack deployed and serving on `dev.<domain>`
- [ ] Staging Compose stack designed and committed but not running
- [ ] Prod Compose stack designed and committed but not running
- [ ] Each stack has its own Docker network, volumes, secrets

**Configuration**

- [ ] `packages/config/src/env/schema.ts` exists with full schema and conditional validation
- [ ] `packages/config/src/env/index.ts` exports validated typed `env` object
- [ ] `.env.example` is committed and lists every variable with documentation and per-driver guidance
- [ ] `.env.local` is gitignored and absent from the repo (gitleaks check passes)
- [ ] ESLint rule blocks `process.env` access outside the env package
- [ ] Env-completeness check runs in CI

**CI/CD**

- [ ] GitHub Actions Environments configured: `dev`, `staging`, `prod`
- [ ] `staging` and `prod` require manual approval; `prod` has wait timer
- [ ] Scoped secrets exist per environment
- [ ] `promote.yml` workflow deploys to dev automatically; staging/prod stubs ready
- [ ] Branch protection on `staging` and `main` requires environment approvals
- [ ] Docker images build and push to GHCR
- [ ] Coolify deploys triggered from CI

**Adapter Selection**

- [ ] All adapter selection env vars defined with valid options
- [ ] Conditional validation: missing required vars per chosen driver fail at startup
- [ ] Default driver set is functional out of the box (postgres + builtin + local + smtp)

**Tooling**

- [ ] `pnpm setup` works from a fresh clone on Linux, macOS, and Windows
- [ ] `pnpm db:reset:dev` exists with confirmation prompt (real impl in Objective 4)
- [ ] `pnpm seed:dev`, `pnpm seed:staging`, `pnpm seed:prod` exist as stubs
- [ ] gitleaks runs in pre-commit and CI (from Objective 1, verified)

**Diagnostic**

- [ ] `/_status` route exists and reports adapter health (basic implementation; expands in later objectives)
- [ ] Access to `/_status` on staging/prod will require auth (placeholder for now)

**Documentation**

- [ ] All runbooks in Section 5.15 written and reviewed
- [ ] ADR-0002, 0003, 0004, 0015, 0016, 0017 written and Accepted
- [ ] `README.md` updated with environment overview, server topology, and onboarding flow
- [ ] `CONTRIBUTING.md` updated with the promotion workflow and local dev modes

**Verification**

- [ ] All 16 verification steps in Section 8 pass
- [ ] Dev environment is reachable, deploys via CI, and serves a "Hello, platform" placeholder

---

## 10. Anti-Patterns to Refuse

- **"Just point staging at the dev database for testing, it's faster."** No. Cross-environment data sharing is the kind of shortcut that produces silent data corruption.
- **"I'll skip the firewall, it's just dev."** No. Dev environments leak. Hardened from day one.
- **Storing the Restic passphrase only in a password manager.** No. Single point of failure. Offline copy in a sealed envelope (or equivalent) is required for true disaster recovery.
- **Hardcoding the domain in code or Compose files.** No. Domain comes from env vars. Always.
- **Using the same `AUTH_SECRET` across environments.** No. Different secrets, different envs.
- **Letting prod credentials touch a developer machine.** Including read-only. Including for "debugging."
- **Skipping conditional schema validation because "it's just config."** No. The schema is the documentation and the safety net.
- **Putting Vercel back in.** No. Locked decision.
- **Using a staging environment as preview for individual PRs.** No. Staging is a stable shared environment that mirrors prod. Per-PR previews come later, separately.
- **Allowing Coolify, Supabase Studio, or any admin interface to be accessible without IP restriction.** No. Admin UIs are IP-restricted; non-static-IP admins use a VPN or a bastion.
- **Skipping the runbooks because "I'll remember."** No. Future-you, in an incident, will not remember.

---

## 11. Open Questions for Confirmation Before Starting

1. **Domain name for dev** — placeholder OK for now? I'll write everything to consume `DOMAIN` from env, so this isn't blocking, but the actual cert issuance needs a real domain at some point.

2. **Backblaze B2 account** — do you have one, or want a different backup target? B2 is the cheapest credible option; alternatives are Wasabi (similar price), AWS S3 Glacier (cheaper for infrequent restore), or another VPS with Restic.

3. **Server IP-restriction list** — which IPs should be allowed for SSH and admin UIs? You'll want at least your home IP and probably a backup (mobile hotspot, work, family member). Document in the runbook.

4. **Static IP at home / work** — if not, you'll need a VPN solution or a bastion host for admin access. Note for the runbook.

5. **Initial adapter choice for dev** — confirming: Postgres + builtin auth + local storage + SMTP (with whatever SMTP provider you use). Or do you want self-hosted Supabase via Coolify from day one (which means storage and identity come from the Supabase adapter)?

6. **Coolify admin email** — for the platform admin user inside Coolify. Use a long-lived address you'll have for years.

---

## 12. What Comes Next

With Objective 2 complete, the platform has a real, working dev environment on the customer's infrastructure. The reference deployment is live. CI deploys to it. Adapter selection is wired up. Backups are configured. Runbooks exist.

**Objective 3: Observability Foundation** is next. Every line of code from Objective 4 onwards must emit structured logs, metrics, and traces — and the infrastructure to receive and display them must exist before that code is written.

After Objective 3, the **Objective 4 family** lands: one objective per database adapter (Postgres first, then MSSQL, then Mongo), each implementing the persistence ports defined in Objective 1.5, each running through the same conformance test suite.

---

_This document is the contract. Every checkbox in Section 9 must be true before moving on._
