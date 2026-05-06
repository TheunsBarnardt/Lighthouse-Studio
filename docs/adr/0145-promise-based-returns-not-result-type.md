# ADR-0145: Promise-Based Returns, Not Result Type

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 19 (Public SDK)

## Context

The platform's internal packages (`@platform/core`, services, adapters) use `Result<T, AppError>` from `neverthrow` for fallible operations, following a functional error-handling pattern. A decision is needed on whether the public SDK follows the same convention or uses native JavaScript Promises.

## Decision

The public SDK uses native Promises. SDK methods return `Promise<T>` and throw `PlatformError` subclasses on failure. The `Result<T, E>` type is not exposed on any public SDK surface.

## Rationale

The `Result<T, E>` pattern is excellent for internal code where all callers are trusted and explicit error handling is enforced. However, for a public SDK consumed by external developers:

1. **Framework integration:** React hooks (`useQuery`, TanStack Query), Vue composables, and `async/await` patterns are built around Promises and `try/catch`. `Result` types don't compose naturally with these.
2. **Ecosystem expectation:** The TypeScript SDK ecosystem (Supabase, Firebase, Stripe, etc.) uses Promises. Customers familiar with those SDKs will have a higher learning curve with `Result`.
3. **JavaScript users:** JavaScript-only customers (not using TypeScript) cannot take advantage of `Result`'s exhaustive checking — they'd just have to handle a more complex API.
4. **Typed errors compensate:** The SDK throws typed `PlatformError` subclasses with stable `.code` properties, so programmatic error handling is still clean without `Result`.

The boundary is explicit: `Result` is an internal implementation detail. The SDK layer converts results to Promises at the API surface.

## Consequences

**Easier:**

- Framework integration (TanStack Query, SWR, Vue composables) requires no wrappers
- Customer code uses familiar `try/catch` and `.catch()` patterns
- Less SDK API surface to document and explain

**Harder:**

- Unhandled promise rejections are possible if customers don't handle errors
- No compile-time enforcement of error handling (though typed errors mitigate this)

**Alternatives considered:**

- **`Result<T, PlatformError>`:** More explicit error handling; rejected due to poor ecosystem fit
- **Both (Result + Promise variants):** More API surface; rejected as unnecessary complexity
