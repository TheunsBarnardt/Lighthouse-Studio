# ADR-0202: Static Analysis as the Second Line of Defense

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

The sandbox prevents runtime escape. But defense in depth requires catching dangerous patterns before the code is even deployed.

## Decision

Generated code passes through AST-based static analysis before being presented for customer review. Forbidden patterns: `eval`, `new Function()`, `child_process`, `fs`, raw socket access, `process.env`, `__proto__` manipulation, dynamic `globalThis` access, imports outside the approved allowlist.

Violations block the code from progressing to the review UI. One AI retry (using the `static-fix` prompt) is automatically attempted. Persistent violations surface to the customer with details.

## Consequences

- Most dangerous patterns are caught before deployment
- Defense in depth: analysis + sandbox + runtime monitoring
- The forbidden patterns list is a security-sensitive artefact, updated as new escape vectors are identified

## Alternatives considered

- **Sandbox only** — insufficient; catching violations early is cheaper and provides clearer feedback
- **Allow-listing everything explicitly** — too restrictive; breaks legitimate patterns
