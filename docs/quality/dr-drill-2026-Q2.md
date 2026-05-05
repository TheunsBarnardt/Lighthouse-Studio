# Disaster Recovery Drill Report — 2026 Q2

**Date:** 2026-05-04
**Environment:** Local Docker Compose (Postgres) — fresh container restore
**Operator:** Theuns Barnardt
**Runbook version:** HEAD (git master, 2026-05-04)
**Status:** PARTIAL — local Postgres restore verified; full DR drill (server loss) requires staging

---

## RTO / RPO Targets

| Target                         | Value                   |
| ------------------------------ | ----------------------- |
| Recovery Time Objective (RTO)  | 4 hours (full DR)       |
| Recovery Point Objective (RPO) | 24 hours (daily backup) |

---

## Scenario Results

### Scenario 1: Single-database restore (local Postgres)

| Step                               | Expected           | Actual                       | Time |
| ---------------------------------- | ------------------ | ---------------------------- | ---- |
| Dump local dev Postgres            | pg_dump success    | ✅ pass                      | 8s   |
| Provision fresh Postgres container | —                  | ✅ pass                      | 12s  |
| Restore from dump                  | pg_restore success | ✅ pass                      | 15s  |
| Verify audit chain integrity       | Valid              | ✅ chain intact (471 events) | 2s   |
| Verify row counts match            | Match              | ✅ match                     | 1s   |
| Reconnect platform                 | —                  | ✅ pass                      | 5s   |
| Verify platform operational        | Auth + data pass   | ✅ sign-in works             | 3s   |

**Total time: 46s**
**Pass/Fail: PASS (local scope)**
**Runbook gaps:** None found. Runbook step 4 ("grant app_user permissions") was slightly unclear — clarified in-place.

---

### Scenario 2: Full server loss simulation

Not run — requires a fresh staging VM and object storage restore. Deferred to staging environment provisioning.

**Target RTO:** < 4 hours
**Status:** ⏳ pending staging

---

### Scenario 3: Partial corruption (audit table)

Simulated locally: manually modified one audit event hash in the dev database, then ran `verifyChain`. Chain verification correctly detected the tampered entry at sequence 47.

```json
{
  "status": "tampered",
  "tamperedAt": {
    "sequence": 47,
    "expectedHash": "a3f1...",
    "actualHash": "000000..."
  }
}
```

Restored from pg_dump, re-ran verifyChain: **chain intact** ✅

---

## Runbook Updates Made This Drill

| Runbook                 | Gap Found                      | Fix Applied                                          |
| ----------------------- | ------------------------------ | ---------------------------------------------------- |
| `backup-and-restore.md` | Step 4 grant wording ambiguous | Clarified `GRANT SELECT, INSERT ON ALL TABLES` scope |

---

## Overall Gate Result

**PARTIAL PASS — local Postgres restore verified; full server-loss DR drill requires staging**

Local restore RTO: 46s (well within 4-hour target). Audit chain integrity verification after restore: PASS. Full DR drill (provision new server, restore from B2, restart services) requires staging environment and is a pre-production gate.
