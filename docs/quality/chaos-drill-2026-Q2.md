# Chaos Drill Report — 2026 Q2

**Date:** 2026-05-04
**Environment:** Local Docker Compose (Postgres) — unit-test mode via vitest
**Operator:** Theuns Barnardt
**Status:** PARTIAL — unit-level scenarios pass; full destructive scenarios require staging environment

---

## Context

The chaos test suite (`tests/chaos/`) uses `requireChaosEnv()` to guard all tests that require a real running environment (Docker kill, real network partition, disk fill). Without `CHAOS_BASE_URL` and `CHAOS_DB_CONTAINER` set, all destructive scenarios are skipped safely.

The unit-mode chaos tests (pure code-path tests) pass on every CI run. Full destructive scenarios require the staging environment. This report documents both.

---

## Drill Summary

| Scenario                      | Script                              | Unit Mode                | Destructive Mode   |
| ----------------------------- | ----------------------------------- | ------------------------ | ------------------ |
| 1. Database connection loss   | `db-connection-loss.test.ts`        | ✅ graceful error paths  | ⏳ pending staging |
| 2. Connection pool exhaustion | `db-pool-exhaustion.test.ts`        | ✅ pool limit handling   | ⏳ pending staging |
| 3. Worker killed mid-job      | `worker-sigkill.test.ts`            | ✅ idempotency + retry   | ⏳ pending staging |
| 4. Web app killed mid-request | `webapp-sigkill.test.ts`            | ✅ error response shape  | ⏳ pending staging |
| 5. Audit log writes fail      | `audit-storage-unavailable.test.ts` | ✅ fail-closed confirmed | ⏳ pending staging |
| 6. Change stream disconnected | `changestream-disconnect.test.ts`   | ✅ reconnect logic       | ⏳ pending staging |
| 7. Disk full                  | `disk-full.test.ts`                 | ✅ log rotation          | ⏳ pending staging |
| 8. Network partition          | `network-partition.test.ts`         | ✅ timeout + retry       | ⏳ pending staging |
| 9. Time skew                  | `time-skew.test.ts`                 | ✅ UTC normalization     | ⏳ pending staging |
| 10. Power loss                | `power-loss.test.ts`                | ✅ DB recovery check     | ⏳ pending staging |
| 11. Concurrent migrations     | `concurrent-migrations.test.ts`     | ✅ lock serialization    | ⏳ pending staging |
| 12. Backup interruption       | `backup-interrupt.test.ts`          | ✅ retry scheduling      | ⏳ pending staging |
| 13. Restore over live         | `restore-over-live.test.ts`         | ✅ safeguard triggered   | ⏳ pending staging |

---

## Pass Criteria Checklist (unit mode)

- [x] Graceful error handling: all scenarios return structured errors, no unhandled exceptions
- [x] Fail-closed audit: audit write failure rejects operations (scenario 5)
- [x] Idempotency: worker restart does not double-execute jobs (scenario 3)
- [x] No data corruption in unit-level assertion paths
- [x] Retry logic: exponential backoff with jitter in all retry paths

---

## Notable Findings

**Scenario 3 (Worker killed mid-job):** Idempotency via `withIdempotency()` (added in Objective 8) prevents double-execution. The test confirms the idempotency key check fires on re-entry. ✅

**Scenario 5 (Audit log writes fail):** The platform returns 503 to the caller when `audit.write()` fails — operations are rejected rather than silently succeeding without an audit trail. This is the correct fail-closed behavior. ✅

---

## Overall Gate Result

**PARTIAL PASS — destructive scenarios require staging environment**

All 13 unit-mode paths pass. Full gate requires running the destructive scenarios against a Docker environment with real kill/partition/fill operations. This report will be updated when staging is provisioned.
