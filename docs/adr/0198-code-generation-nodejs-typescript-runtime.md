# ADR-0198: Node.js 22 + TypeScript as the Server Runtime

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 27 — Code Generation

## Context

Generated server functions need a runtime environment. Options considered: Node.js, Deno, Bun.

## Decision

Node.js 22 LTS with TypeScript. Generated functions are compiled to ESM bundles by esbuild before deployment.

## Consequences

- Largest ecosystem; customers and platform team are familiar with it
- Long-term support lifecycle ensures stability
- Deno's permission model was appealing for security but has a smaller ecosystem and less production use
- Bun's speed is promising but insufficient production track record for v1

## Alternatives considered

- **Deno** — better built-in permissions; smaller ecosystem; deferred to a future review
- **Bun** — faster cold starts; ecosystem maturity insufficient for v1
