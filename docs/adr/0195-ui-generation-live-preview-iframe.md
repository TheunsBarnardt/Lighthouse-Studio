# ADR-0195: Live Preview via Sandboxed iframe

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 26 — UI Generation

## Context

The code review UI needs to show how each generated component looks. Options include a screenshot, a simulated mock, or a live render.

## Decision

In production, each component is rendered in a sandboxed iframe pointed at a per-session Vite dev server. The iframe is `sandbox="allow-scripts allow-same-origin"` with CSP `frame-src 'self'`. The preview server starts when the project is first generated and stays alive for the session.

In development / demo mode, the platform renders a hand-crafted mock preview (MockListPreview, MockDetailPreview, etc.) that approximates the component's layout.

## Consequences

- Live preview shows real component output including Tailwind styles
- Sandboxed iframe prevents preview code from accessing the parent app
- Preview server adds ~200 MB memory per active session; session idle timeout is 30 minutes
- Mock preview used in demo avoids the need for a running Node process

## Alternatives considered

- **Screenshots via Playwright** — slow to update; stale after every edit
- **Code execution in main window** — unsafe; generated code could corrupt app state
- **Static mock only** — fast but doesn't reflect actual generated output
