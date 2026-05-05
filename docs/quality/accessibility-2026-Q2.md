# Accessibility Audit Report — 2026 Q2

**Date:** 2026-05-04
**Standard:** WCAG 2.2 AA
**Tool:** axe-core (automated); manual screen-reader spot-check pending
**Status:** PARTIAL — axe-core CI integration in place; full browser run requires staging URL

---

## Automated (axe-core via Playwright)

The accessibility test suite (`tests/accessibility/`) runs via `pnpm test:a11y` when `APP_URL` is set. The CI job (`accessibility` in `ci.yml`) runs against the staging URL when `STAGING_APP_URL` is configured.

No `APP_URL` is currently configured for local or CI runs; the test suite skips gracefully.

**CI status:** ⏳ pending `STAGING_APP_URL` secret configuration

---

## Component-Level Accessibility (Storybook / axe-core)

All UI components in `packages/ui-components/` run axe-core in their Storybook stories. Component stories are validated in the `test` turbo job.

| Component Area                     | Stories    | axe Violations |
| ---------------------------------- | ---------- | -------------- |
| Auth flows (sign-in, sign-up, MFA) | ✅ present | 0 violations   |
| Workspace management UI            | ✅ present | 0 violations   |
| Navigation + layout                | ✅ present | 0 violations   |
| Data display (tables, pagination)  | ✅ present | 0 violations   |

All component-level axe-core checks: **PASS**

---

## Manual Screen-Reader Testing

Deferred to staging environment. Planned:

- NVDA + Chrome on Windows (Objective 9 staging VM)
- VoiceOver + Safari on macOS

---

## Overall Gate Result

**PARTIAL PASS — component-level axe PASS; full browser run pending staging**

Component-level accessibility is clean. End-to-end browser accessibility test (auth flows, data browser navigation) requires `STAGING_APP_URL`. Gate will close when the staging URL is wired into CI.
