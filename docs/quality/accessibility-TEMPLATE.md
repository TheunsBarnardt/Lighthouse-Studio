# Accessibility Audit Report

**Date:** YYYY-MM-DD
**Standard:** WCAG 2.2 Level AA
**Pages audited:** sign-in, sign-up, workspace list, account settings
**Status:** PENDING — audit not yet run

---

## Automated Audit — axe-core

Run via CI on every foundation page. Results from last CI run:

| Page              | Critical Violations | Serious Violations | Moderate Violations | Minor Violations |
| ----------------- | ------------------- | ------------------ | ------------------- | ---------------- |
| /auth/sign-in     | —                   | —                  | —                   | —                |
| /auth/sign-up     | —                   | —                  | —                   | —                |
| /workspaces       | —                   | —                  | —                   | —                |
| /account/settings | —                   | —                  | —                   | —                |

**Pass criteria:** Zero critical or serious violations. Minor violations triaged (documented below).

---

## Manual Screen Reader Testing

### NVDA on Windows

| Flow                      | Completable? | Semantic structure understood? | Live updates announced? | Notes |
| ------------------------- | ------------ | ------------------------------ | ----------------------- | ----- |
| Sign-in                   | PENDING      | PENDING                        | PENDING                 | —     |
| Sign-up                   | PENDING      | PENDING                        | PENDING                 | —     |
| Workspace list navigation | PENDING      | PENDING                        | PENDING                 | —     |
| Account settings          | PENDING      | PENDING                        | PENDING                 | —     |

### VoiceOver on macOS

| Flow                      | Completable? | Semantic structure understood? | Live updates announced? | Notes |
| ------------------------- | ------------ | ------------------------------ | ----------------------- | ----- |
| Sign-in                   | PENDING      | PENDING                        | PENDING                 | —     |
| Sign-up                   | PENDING      | PENDING                        | PENDING                 | —     |
| Workspace list navigation | PENDING      | PENDING                        | PENDING                 | —     |
| Account settings          | PENDING      | PENDING                        | PENDING                 | —     |

---

## Keyboard-Only Navigation

| Flow                      | Completable without mouse? | No keyboard traps? | Notes |
| ------------------------- | -------------------------- | ------------------ | ----- |
| Sign-in                   | PENDING                    | PENDING            | —     |
| Sign-up                   | PENDING                    | PENDING            | —     |
| Workspace list navigation | PENDING                    | PENDING            | —     |
| Account settings          | PENDING                    | PENDING            | —     |

---

## Color Contrast

| Element category        | Ratio required | Checked | Pass?   |
| ----------------------- | -------------- | ------- | ------- |
| Body text               | 4.5:1          | PENDING | PENDING |
| Large text (≥18pt)      | 3:1            | PENDING | PENDING |
| UI component boundaries | 3:1            | PENDING | PENDING |
| Focus indicators        | 3:1            | PENDING | PENDING |

Tool used: (e.g., Colour Contrast Analyser, browser DevTools)

---

## Focus Management

| Behavior                                                | Status  |
| ------------------------------------------------------- | ------- |
| Focus visible on all interactive elements               | PENDING |
| Focus order is logical (top-to-bottom, left-to-right)   | PENDING |
| Focus trapped in modals (cannot escape without closing) | PENDING |
| Focus returns to trigger after modal closes             | PENDING |

---

## ARIA Usage

| Check                                              | Status  |
| -------------------------------------------------- | ------- |
| All interactive elements have accessible names     | PENDING |
| Landmark roles present (main, nav, header, footer) | PENDING |
| Live regions used for dynamic content              | PENDING |
| No ARIA used where native semantics suffice        | PENDING |

---

## Issues Found

| ID        | Severity | Page | Description | Status |
| --------- | -------- | ---- | ----------- | ------ |
| (fill in) |          |      |             |        |

Items not fixed before gate pass are deferred with tracked GitHub issue and target date.

---

## CI Integration

- [ ] axe-core check added to CI (`pnpm test:a11y` or equivalent)
- [ ] Check runs on every PR targeting foundation pages
- [ ] Any new serious/critical violation fails the build

---

## Overall Gate Result

**PENDING**
