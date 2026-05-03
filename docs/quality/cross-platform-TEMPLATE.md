# Cross-Platform Runtime Verification Report

**Date:** YYYY-MM-DD
**Linux environment:** (OS version, Node version, deployment method)
**Windows environment:** (OS version, Node version, IIS version, deployment method)
**Status:** PENDING — verification not yet run

---

## Test Battery

The same test suite runs against both platforms. Results compared for behavioral equivalence.

Command:

```sh
pnpm test:cross-platform
```

### Linux Results

| Suite                                  | Tests | Pass | Fail | Skip |
| -------------------------------------- | ----- | ---- | ---- | ---- |
| Auth flow (sign-in, sign-up, sign-out) | —     | —    | —    | —    |
| Session management                     | —     | —    | —    | —    |
| RBAC / permission checks               | —     | —    | —    | —    |
| Audit log write + read                 | —     | —    | —    | —    |
| Change stream events                   | —     | —    | —    | —    |
| File path handling                     | —     | —    | —    | —    |
| Process signals (SIGTERM, SIGINT)      | —     | —    | —    | —    |
| Time zone handling                     | —     | —    | —    | —    |
| **Total**                              | —     | —    | —    | —    |

**Pass/Fail:** PENDING

### Windows Results

| Suite                                  | Tests | Pass | Fail | Skip |
| -------------------------------------- | ----- | ---- | ---- | ---- |
| Auth flow (sign-in, sign-up, sign-out) | —     | —    | —    | —    |
| Session management                     | —     | —    | —    | —    |
| RBAC / permission checks               | —     | —    | —    | —    |
| Audit log write + read                 | —     | —    | —    | —    |
| Change stream events                   | —     | —    | —    | —    |
| File path handling                     | —     | —    | —    | —    |
| Process signals (Windows service stop) | —     | —    | —    | —    |
| Time zone handling                     | —     | —    | —    | —    |
| **Total**                              | —     | —    | —    | —    |

**Pass/Fail:** PENDING

---

## Behavioral Comparison

| Behavior                     | Linux   | Windows | Equivalent? |
| ---------------------------- | ------- | ------- | ----------- |
| Auth token issuance          | PENDING | PENDING | PENDING     |
| Session cookie attributes    | PENDING | PENDING | PENDING     |
| Audit event timestamps (UTC) | PENDING | PENDING | PENDING     |
| File upload paths            | PENDING | PENDING | PENDING     |
| Observability output format  | PENDING | PENDING | PENDING     |

---

## Performance Baseline Comparison

Windows is allowed to be slightly slower; documented as a platform note.

| Metric          | Linux p95 | Windows p95 | Delta | Acceptable? |
| --------------- | --------- | ----------- | ----- | ----------- |
| Sign-in latency | —         | —           | —     | PENDING     |
| Workspace list  | —         | —           | —     | PENDING     |
| Audit log query | —         | —           | —     | PENDING     |

---

## Customer Windows Deployment Guide Test

The Windows deployment guide tested by a fresh-VM walkthrough:

- Guide version: (git commit)
- Fresh VM: (OS, from scratch with no prior platform install)
- Time to operational: PENDING
- Steps that required clarification or were incorrect: (list)
- Guide updated: (yes/no)

---

## Platform-Specific Bugs Found

| Bug       | Severity | Platform | Status |
| --------- | -------- | -------- | ------ |
| (fill in) |          |          |        |

---

## Overall Gate Result

**PENDING**

Foundation tests pass on both platforms. No platform-specific bugs. Performance baselines met on both. Customer Windows deployment guide tested.
