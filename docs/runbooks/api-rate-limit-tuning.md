# Runbook: API Rate Limit Tuning

**Audience:** Platform operators, workspace admins
**Relates to:** Objective 12, ADR-0103

---

## Overview

The customer REST API enforces token-bucket rate limits per (workspace, principal) pair. Defaults:

- **1,000 requests/minute** per principal
- **Bulk endpoints** count as 10 tokens (so 100 bulk requests/minute effectively)

This runbook covers: diagnosing rate-limit storms, adjusting per-workspace limits, and unblocking specific principals.

---

## Signals That Rate Limiting Is the Problem

1. Clients receive `429 Too Many Requests` responses with a `Retry-After` header.
2. The `platform_api_rate_limit_rejections_total{workspace, principal_kind}` counter is climbing.
3. Support tickets from a workspace report "API returning 429" or "requests failing intermittently."

---

## Diagnosing a Rate-Limit Storm

**Step 1: Identify the workspace and principal**

Look at the 429 response body:

```json
{
  "type": "https://platform.example.com/errors/rate_limited",
  "correlationId": "abc123",
  "detail": "Rate limit exceeded. Retry after 12000ms.",
  "retryAfterMs": 12000
}
```

Use the `correlationId` to find the audit event `data_management.api.rate_limited` in the audit log. The actor field identifies the principal (user or API key).

**Step 2: Check the actual request rate**

Query the metrics:

```
rate(platform_api_requests_total{workspace="acme", status="429"}[5m])
```

Compare to the allowed rate. If the observed rate is near or above the limit, the client is legitimately hitting the limit. If the rate is low but still getting 429s, the bucket may not be recovering (check refill rate config).

**Step 3: Distinguish legitimate load from runaway client**

A legitimate burst (e.g., scheduled data sync at midnight) should back off and retry. A runaway client (bug, infinite loop) will not back off. Check whether the client respects the `Retry-After` header.

---

## Adjusting Per-Workspace Limits

Rate limits are stored in the workspace configuration. A workspace admin can adjust via the UI or via the platform admin API.

**Via platform admin API:**

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/rate-limits
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "apiRequestsPerMinute": 5000,
  "bulkMultiplier": 10
}
```

The change takes effect within 60 seconds (cache TTL). No restart required.

**Recommended limits by tier:**
| Tier | Requests/min | Notes |
|-----------|-------------|----------------------------------|
| Free | 500 | Default |
| Standard | 1,000 | Default |
| Pro | 5,000 | For higher-volume integrations |
| Enterprise| Negotiated | Contact support |

---

## Unblocking a Specific Principal

If a specific API key or user is rate-limited and you need to clear their bucket immediately (e.g., a bug caused a spike; it's fixed; unblock them now):

```bash
POST /api/v1/admin/rate-limits/reset
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "bucketKey": "workspace:<workspace_id>:principal:<principal_id>"
}
```

This resets the token bucket to full capacity. The next request is allowed immediately.

---

## Troubleshooting: Rate Limiter Backend Down

If the rate-limiter backend (Redis or database-backed) is unavailable, the platform **fails open** (allows requests) with a warning log. Check:

1. `platform.rate_limiter.backend_failure_total` metric for spikes.
2. Redis health (if using Redis adapter): `redis-cli ping`.
3. Logs for `RateLimitError` with `kind: BACKEND_FAILURE`.

If the backend is persistently down and you need to re-enable enforcement, restart the rate-limiter adapter after the backend recovers.

---

## Prevention

- Configure per-workspace limits before a customer goes to production.
- Advise customers to implement exponential backoff with jitter when they receive 429 responses.
- Monitor `platform_api_rate_limit_rejections_total` and alert if it exceeds 1% of total requests for any workspace.
