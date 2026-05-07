# ADR-0207: Use Vitest and Playwright as the Test Generation Stack

**Status:** Accepted  
**Date:** 2026-05-07  
**Objective:** 28 (Test Generation)

## Context

Stage 8 generates test code for projects built on Vite + React + TypeScript. We need a test framework for unit/component tests and a separate runner for browser-based e2e tests. The choice must be stable, well-documented, and compatible with the generated project tech stack.

## Decision

Use **Vitest** for unit, component, and integration tests and **Playwright** for e2e tests.

- Vitest: natively understands Vite config, supports TypeScript without extra setup, has compatible `vi` API with vitest globals
- Playwright: cross-browser, auto-waiting, role-based selectors, excellent trace viewer for debugging
- @testing-library/react for component tests (role-based queries, accessibility-first)

## Consequences

- Generated test files import from `vitest` and `@playwright/test`; switching frameworks requires regenerating all test files
- Coverage is collected by Vitest's built-in v8 provider
- Two config files are always co-generated: `vitest.config.ts` and `playwright.config.ts`

## Alternatives Considered

- **Jest + Puppeteer**: slower cold start, requires babel transform for ESM; rejected
- **Cypress**: single-tool e2e but poor unit test story; rejected
