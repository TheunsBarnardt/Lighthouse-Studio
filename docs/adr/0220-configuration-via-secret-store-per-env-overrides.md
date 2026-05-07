# ADR-0220: Configuration via SecretStorePort with Per-Environment Overrides

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 29 (Deployment)

## Context

Applications need different configuration values per environment (different API keys, feature flags, rate limits). We must decide how per-environment configuration is managed and injected.

## Decision

All per-environment configuration is stored via `SecretStorePort`. The deployment plan specifies which configuration keys apply per environment; the deployment executor reads from the secret store at deploy time and injects values into the runtime.

Most configuration is hot-reloadable (no redeploy required to change a value). Configuration that requires a redeploy (compile-time feature flags) is explicitly marked in the deployment plan.

Secrets are never logged. They are redacted in streamed deployment logs and audit entries.

## Consequences

- Operators can update configuration (e.g., rotate an API key) without triggering a new deployment
- Deployment plan documents which config keys each environment uses
- Secret store must be accessible from the deployment orchestrator

## Alternatives Considered

- **Hardcoded per-environment config files**: secrets in source control risk; rejected
- **Environment variables only**: not hot-reloadable; no audit trail; rejected
