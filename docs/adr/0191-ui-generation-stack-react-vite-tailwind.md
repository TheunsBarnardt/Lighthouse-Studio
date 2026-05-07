# ADR-0191: UI Generation Stack — React + Vite + Tailwind + shadcn/ui

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26 — UI Generation

## Context

The UI generation pipeline must produce a complete React application. The chosen stack must be:
- Widely adopted (maintainable by any React developer)
- Fast to build and iterate
- Compatible with the platform's design token system

## Decision

Generated projects use: React 18 + Vite 5 + TypeScript strict + Tailwind CSS 3 + shadcn/ui base components.

Supporting libraries: TanStack Query (server state), React Router v6 (routing), react-hook-form + zod (forms), @tanstack/react-table (tables).

## Consequences

- Generated code is readable and idiomatic — no proprietary abstractions
- shadcn/ui components can be customised by the customer post-export
- Vite produces optimal bundles without config overhead
- TypeScript strict catches errors during generation

## Alternatives considered

- **Next.js** — ruled out; adds SSR complexity customers may not need; harder to self-host
- **Remix** — good DX but smaller ecosystem; less familiar
- **Create React App** — deprecated upstream
