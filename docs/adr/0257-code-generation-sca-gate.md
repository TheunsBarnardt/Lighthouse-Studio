# ADR-0257: Generation-Time Software Composition Analysis (SCA) Gate

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Generated `package.json` files specify npm dependencies. If a generated dependency has a known vulnerability, it should be surfaced before the customer reviews or deploys the code.

## Decision

When the orchestrator produces a generated `package.json`, the SCA gate runs:
1. Resolve the dependency tree into a lockfile
2. Scan the lockfile against the `VulnerabilityScannerPort` (backed by Snyk, OSV, or npm audit)
3. Render findings inline in the change preview UI

Findings at severity `high` or `critical` block progression until the customer explicitly acknowledges each finding. `moderate` and `low` findings are shown as warnings but do not block.

Scan results are audited via `generation.scan.*` events. The gate runs against the resolved lockfile (not the raw `package.json` ranges) to ensure deterministic results.

## Consequences

- Vulnerable dependencies in generated code are surfaced before deployment, not after
- The `VulnerabilityScannerPort` abstracts the vulnerability database; can switch providers
- Scan adds ~10 seconds to generation time; acceptable

## Alternatives considered

- **Post-deployment scanning only** — vulnerable code reaches production before being flagged; unacceptable
- **Block on any finding** — too aggressive; `low` severity would prevent most packages from being used
