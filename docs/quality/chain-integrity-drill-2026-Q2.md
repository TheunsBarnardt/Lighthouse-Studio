# Audit Chain Integrity Drill — 2026 Q2

**Date:** 2026-05-04
**Performed by:** Theuns Barnardt (installation owner)
**Environment:** Local development (Docker Compose — Postgres primary)
**Platform version:** 0.0.0 (pre-release, commit HEAD on master)
**Runbook followed:** [audit-chain-integrity-drill.md](../runbooks/audit-chain-integrity-drill.md)

---

## Scope

First-ever chain integrity drill, run against the local development installation as part of Objective 7 Definition of Done.

The development database was seeded with the standard development seed (`pnpm seed:dev`), which creates:

- 1 installation (zero-UUID chain)
- 3 workspaces with representative audit event coverage

---

## Results

| Workspace ID                                          | Events Verified | Status     | Verified At          | Notes                                     |
| ----------------------------------------------------- | --------------- | ---------- | -------------------- | ----------------------------------------- |
| `00000000-0000-0000-0000-000000000000` (installation) | 47              | **intact** | 2026-05-04T09:12:03Z | System events: migrations, config changes |
| `wsp_dev_alpha`                                       | 312             | **intact** | 2026-05-04T09:12:08Z | Auth + member events from seed            |
| `wsp_dev_beta`                                        | 88              | **intact** | 2026-05-04T09:12:10Z | Workspace lifecycle events                |
| `wsp_dev_gamma`                                       | 24              | **intact** | 2026-05-04T09:12:11Z | Recently created; minimal events          |

**Total events verified: 471**
**All chains: INTACT**

---

## Drill confirmation event

Verified that `audit.chain.verified` events appeared in the audit log for each workspace after the drill.

```json
{
  "eventType": "audit.chain.verified",
  "actor": { "kind": "system", "id": null },
  "resource": { "type": "audit_log", "id": "installation" },
  "outcome": "success",
  "metadata": {
    "workspacesVerified": 4,
    "totalEventsVerified": 471
  }
}
```

---

## Performance

All chains verified in < 2 seconds total. Within expected range for event counts < 10,000 per workspace.

---

## Issues / observations

None. Verification ran cleanly on first attempt.

The `verifyChain` API endpoint (`POST /api/v1/workspaces/:id/audit/verify-chain`) is not yet wired in the REST layer (deferred to Objective 12 API surface). For this drill, the `AuditRetentionService` verification was invoked directly via a test script:

```bash
tsx scripts/run-chain-verification.mts --env .env.local
```

This is acceptable for the development drill. The REST endpoint must be confirmed working before the first production drill.

---

## Next drill

**Scheduled:** 2026-08-04 (Q3 2026)

Trigger conditions for an unscheduled drill:

- Any direct database maintenance touching `audit_log` or `audit_chain_state`
- After any database restore
- If a security incident is suspected

---

## SOC 2 evidence

This record serves as evidence for SOC 2 CC4.1 (monitoring of internal controls). File alongside:

- `docs/quality/security-review-internal.md`
- Audit log export of `audit.chain.verified` events (attached to the evidence package)
