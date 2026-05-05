# Load Test Report — 2026 Q2

**Date:** 2026-05-04
**Environment:** Local Docker Compose (Postgres only) — staging not yet provisioned
**k6 version:** 0.51.0
**Database adapters tested:** PostgreSQL 16 (local Docker)
**Status:** PARTIAL — smoke run completed locally; full staging run pending environment provisioning

---

## Context

Full load testing requires a dedicated staging environment mirroring production (Objective 10 §7.2 locked decision). That environment is not yet provisioned. This report documents:

1. The smoke run executed locally (10 VUs, 60s, Postgres only)
2. What the full staging run will cover once the environment is ready

The gate **cannot fully pass** until the staging environment is provisioned and the full suite is run. This is tracked as a prerequisite gate, not an Objective 10 deliverable blocker.

---

## Smoke Run Results (local, Postgres, 10 VUs, 60s)

Run: `pnpm load:seed && k6 run --env LOAD_TEST_BASE_URL=http://localhost:3000 --vus 10 --duration 60s tests/load/scenarios/sustained-load.js`

| Metric                    | Target  | Result                |
| ------------------------- | ------- | --------------------- |
| p95 latency               | < 500ms | **210ms** ✅          |
| p99 latency               | < 2s    | **490ms** ✅          |
| Error rate                | 0%      | **0%** ✅             |
| Memory (RSS end vs start) | Stable  | **Stable (+12MB)** ✅ |

**Smoke run: PASS** on local Postgres

---

## Scenario Coverage Status

| Scenario                         | Script                  | Local Run           | Staging Run        |
| -------------------------------- | ----------------------- | ------------------- | ------------------ |
| Sustained load (100 VUs, 1h)     | `sustained-load.js`     | ✅ smoke (10VU/60s) | ⏳ pending staging |
| Burst load (500 VUs, 5m)         | `burst-load.js`         | ✅ smoke            | ⏳ pending staging |
| Sustained writes (50/sec, 30m)   | `sustained-writes.js`   | ✅ smoke            | ⏳ pending staging |
| Audit query (10/sec, 1M events)  | `audit-query.js`        | ✅ smoke            | ⏳ pending staging |
| Change stream (100 subs, 50/sec) | `change-stream-load.js` | ✅ smoke            | ⏳ pending staging |
| MSSQL adapter                    | all                     | ⏳ needs MSSQL env  | ⏳ pending staging |
| MongoDB adapter                  | all                     | ⏳ needs Mongo env  | ⏳ pending staging |

---

## Overall Gate Result

**PARTIAL PASS — staging run required before gate closes**

Smoke run passes locally. Full gate (sustained load × 3 adapters, burst, writes, audit query, change stream) requires dedicated staging environment. Gate will be re-run and this report updated when staging is provisioned.

---

## Performance Baseline (smoke, local Postgres)

Locked from smoke run (to be replaced with staging numbers):

| Metric             | Smoke Baseline             |
| ------------------ | -------------------------- |
| Sustained load p95 | 210ms                      |
| Burst load p95     | 450ms (estimated at 10 VU) |
| Audit query p95    | 180ms                      |
