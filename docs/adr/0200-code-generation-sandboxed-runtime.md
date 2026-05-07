# ADR-0200: Sandboxed Runtime with Hard Resource Limits

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Generated server-side code is the highest-risk output of the platform. A customer's AI-generated function could: escape its sandbox, access another workspace's data, exhaust shared resources, or execute malicious code.

## Decision

All generated functions run in a sandboxed process with hard limits:
- Process isolation (one Node process per invocation; not threads)
- 30-second wall-clock timeout (default); 5-minute maximum with explicit permission
- 256 MB memory limit (default); configurable
- Outbound HTTPS only; per-function hostname allowlist
- No filesystem access except declared tmpfs
- Secrets via context injection; never environment or files

The specific isolation library (gVisor, Firecracker, hardened vm module) is determined by Objective 10's security review.

## Consequences

- Defense in depth: static analysis is the first line; sandbox is the second
- Cold-start cost varies by isolation approach (gVisor/Firecracker: 100–500ms overhead; vm: minimal)
- The platform team owns the runtime; customers cannot change isolation settings

## Alternatives considered

- **No sandbox** — unacceptable security posture for multi-tenant platform
- **Thread-based isolation** — insufficient; memory and handles are shared within a process
