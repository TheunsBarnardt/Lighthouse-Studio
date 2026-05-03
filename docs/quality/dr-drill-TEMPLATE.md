# Disaster Recovery Drill Report

**Date:** YYYY-MM-DD
**Environment:** fresh staging VM (not the regular staging environment)
**Operator:** (name)
**Runbook version:** (git commit of runbook used)
**Status:** PENDING — drill not yet run

---

## RTO / RPO Targets

| Target                         | Value                   |
| ------------------------------ | ----------------------- |
| Recovery Time Objective (RTO)  | 4 hours (full DR)       |
| Recovery Point Objective (RPO) | 24 hours (daily backup) |

---

## Scenario Results

### Scenario 1: Single-database restore

**Goal:** Restore yesterday's backup to a fresh instance; verify integrity; reconnect; verify operational.

| Step                           | Expected                     | Actual  | Time |
| ------------------------------ | ---------------------------- | ------- | ---- |
| Provision fresh DB instance    | —                            | PENDING | —    |
| Restore from backup            | —                            | PENDING | —    |
| Verify audit chain integrity   | Valid                        | PENDING | —    |
| Verify foreign key consistency | No violations                | PENDING | —    |
| Verify row counts              | Match expected               | PENDING | —    |
| Reconnect platform             | —                            | PENDING | —    |
| Verify platform operational    | Auth + data round-trips pass | PENDING | —    |

**Total time:** PENDING
**Pass/Fail:** PENDING
**Runbook gaps:**

---

### Scenario 2: Object storage restore

**Goal:** Restore stored files from Backblaze B2 to a fresh storage backend; verify integrity.

| Step                               | Expected   | Actual  | Time |
| ---------------------------------- | ---------- | ------- | ---- |
| Provision fresh storage backend    | —          | PENDING | —    |
| Restore from B2                    | —          | PENDING | —    |
| Verify checksums (all files match) | 100% match | PENDING | —    |
| Platform reads restored files      | No errors  | PENDING | —    |

**Total time:** PENDING
**Pass/Fail:** PENDING
**Runbook gaps:**

---

### Scenario 3: Full server loss

**Goal:** Provision new server from scratch; follow runbook; restore DB + storage; restart services; verify operational.

| Step                           | Expected                     | Actual  | Elapsed |
| ------------------------------ | ---------------------------- | ------- | ------- |
| Provision new server           | —                            | PENDING | —       |
| Follow DR runbook step-by-step | No ad-hoc decisions needed   | PENDING | —       |
| Restore database               | —                            | PENDING | —       |
| Restore object storage         | —                            | PENDING | —       |
| Restore secrets / env config   | —                            | PENDING | —       |
| Start services                 | —                            | PENDING | —       |
| Verify fully operational       | Auth + data + audit all pass | PENDING | —       |
| **Total elapsed**              | < 4 hours                    | PENDING | —       |

**Pass/Fail:** PENDING
**Runbook gaps:**

---

### Scenario 4: Partial corruption (audit table)

**Goal:** Simulate corruption; verify chain verification detects it; restore; verify integrity after restore.

| Step                                   | Expected           | Actual  |
| -------------------------------------- | ------------------ | ------- |
| Inject corruption into audit table     | —                  | PENDING |
| Run chain integrity check              | Detects corruption | PENDING |
| Restore audit table from backup        | —                  | PENDING |
| Run chain integrity check post-restore | Chain valid        | PENDING |

**Pass/Fail:** PENDING
**Runbook gaps:**

---

### Scenario 5: Encryption passphrase recovery

**Goal:** Verify the Restic encryption passphrase recovery process works end-to-end.

| Step                                             | Expected                       | Actual  |
| ------------------------------------------------ | ------------------------------ | ------- |
| Locate passphrase via documented recovery method | Found without direct knowledge | PENDING |
| Decrypt a test backup using recovered passphrase | Successful                     | PENDING |
| Recovery method is documented in runbook         | Yes                            | PENDING |

**Pass/Fail:** PENDING
**Runbook gaps:**

---

## Runbook Updates Made This Drill

| Runbook   | Gap Found | Fix Applied |
| --------- | --------- | ----------- |
| (fill in) |           |             |

---

## Overall Gate Result

**PENDING**

All five scenarios must pass. RTO met on Scenario 3. RPO verified on all scenarios.
