# ADR-0147: Cross-Runtime Support via Runtime Adapter

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 19 (Public SDK)

## Context

The SDK must work in browser, Node.js 22+, Deno, Bun, React Native, and Cloudflare Workers. These runtimes differ in:

- `fetch` availability and behavior (native in modern runtimes; subtle behavioral differences)
- `WebSocket` constructor (native in browsers and Workers; `ws` package needed in some Node versions)
- Cookie handling (browser handles automatically; other runtimes need explicit headers)
- File/Buffer types (browser `File`/`Blob`; Node `Buffer`)

A decision is needed on how to abstract these differences.

## Decision

A `RuntimeAdapter` interface is defined in `packages/sdk/src/runtime/`. The adapter exposes `fetch`, `WebSocket`, and `isBrowser`. At runtime, `getRuntime()` uses feature detection (not user-agent strings) to return the appropriate implementation.

For the Node-specific entry point (`dist/index.node.js`), a compile-time flag `__PLATFORM_RUNTIME__` is defined as `"node"` by tsup, which bypasses feature detection and uses `ws` directly. The `package.json` exports field routes to the correct entry point based on the customer's bundler conditions.

Customers can override the runtime via `setRuntime()` — useful for React Native (which has a non-standard `WebSocket`) and for testing.

## Consequences

**Easier:**

- Single source codebase for all runtimes; runtime-specific code is isolated in `src/runtime/`
- Testing uses `setRuntime()` to inject mock fetch without patching globals
- React Native users can plug in their native `WebSocket` without forking the SDK

**Harder:**

- Node-specific behavior (e.g., cookie jar, proxy support) requires the node entry point to be selected by the bundler
- Some edge runtimes (Cloudflare Workers) have subtle fetch differences that require testing per-runtime

**Alternatives considered:**

- **Separate packages per runtime:** Cleaner interfaces; rejected — maintenance overhead multiplied by number of runtimes; breaking changes must be synchronized across all packages
- **User-agent detection:** Fragile; rejected — feature detection is more reliable
- **Node polyfills in browser bundle:** Bloats bundle with Node shims; rejected
