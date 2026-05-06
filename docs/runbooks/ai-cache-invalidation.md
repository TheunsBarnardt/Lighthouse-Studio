# Runbook: AI Response Cache Invalidation

**Audience:** Platform engineers, platform operators
**Relates to:** Objective 20, ADR-0155

---

## Overview

The platform caches AI responses in `ai_response_cache` using a hash of `(provider, model, system_prompt, user_prompt, parameters)`. Cache hits avoid sending the request to the provider, reducing cost and latency. This runbook covers the scenarios that require cache invalidation, the methods available, and how to monitor the cache after invalidation.

---

## When to Invalidate the Cache

### Scenario 1: Prompt version bump

When a prompt's `version` field is bumped (e.g., from `1.2.0` to `1.3.0`), the cache key changes automatically because `prompt_version` is part of the system prompt rendering context. **No manual invalidation is needed** for prompt version bumps — old cache entries are naturally orphaned and will expire via TTL.

Exception: if the version bump was a typo-fix patch bump (`1.2.0` to `1.2.1`) where you want to start fresh rather than wait for TTL expiry, follow the manual invalidation steps in Step 2.

### Scenario 2: Model deprecation

When a provider deprecates a model, the `model` component of the cache key changes when the platform is updated to use the replacement model. Existing cache entries for the old model are orphaned. Invalidation is optional — they will expire via TTL — but you may want to purge them early to reclaim storage.

### Scenario 3: Discovered hallucination in a cached response

If a cached response is known to be incorrect — hallucinated content, factually wrong reasoning, output that violated a policy — the cache entry must be deleted immediately so users do not receive the bad response.

This is the most urgent invalidation scenario. Treat it as high priority.

### Scenario 4: Suspected stale cache affecting quality investigation

If you are diagnosing a quality regression and want to rule out the cache serving stale responses, use the `bypass_cache` control in `GenerateInput` (see Step 4) rather than deleting cache entries.

---

## Step 1: Identify the Cache Entries to Invalidate

### By prompt_id and prompt_version

```sql
SELECT
  id,
  cache_key_hash,
  prompt_id,
  prompt_version,
  provider,
  model,
  expires_at,
  created_at
FROM ai_response_cache
WHERE prompt_id = '<prompt_id>'
  AND prompt_version = '<prompt_version>'
ORDER BY created_at DESC;
```

This shows all cached responses for a specific prompt version.

### By prompt_id across all versions

```sql
SELECT
  prompt_id,
  prompt_version,
  COUNT(*) AS entry_count,
  MIN(expires_at) AS earliest_expiry,
  MAX(expires_at) AS latest_expiry
FROM ai_response_cache
WHERE prompt_id = '<prompt_id>'
GROUP BY prompt_id, prompt_version;
```

### By model (for model deprecation)

```sql
SELECT
  prompt_id,
  prompt_version,
  model,
  COUNT(*) AS entry_count
FROM ai_response_cache
WHERE model = '<deprecated_model>'
GROUP BY prompt_id, prompt_version, model;
```

---

## Step 2: Delete Cache Entries

### Delete by prompt_id + prompt_version (most common)

```sql
DELETE FROM ai_response_cache
WHERE prompt_id = '<prompt_id>'
  AND prompt_version = '<prompt_version>';
```

Run `EXPLAIN` before executing on large tables to confirm the index is being used (`indexes: [expires_at]` exists; add a partial index on `prompt_id` if this query is slow).

### Delete by model

```sql
DELETE FROM ai_response_cache
WHERE model = '<deprecated_model>';
```

### Delete by specific cache key hash (single entry, hallucination case)

If you have identified the exact cache key hash from logs or from the `ai_usage_records.cache_key_hash` column:

```sql
DELETE FROM ai_response_cache
WHERE cache_key_hash = '<64_char_hash>';
```

### Set expires_at to now (soft expiry, preferred for non-urgent cases)

Instead of deleting, you can soft-expire entries. They will not be served to users but will be cleaned up by the normal TTL expiry job:

```sql
UPDATE ai_response_cache
SET expires_at = NOW()
WHERE prompt_id = '<prompt_id>'
  AND prompt_version = '<prompt_version>';
```

The cache lookup checks `expires_at > NOW()`, so soft-expired entries are immediately inactive without requiring a `DELETE`.

---

## Step 3: Verify Invalidation

After deleting or soft-expiring entries, verify they are no longer being served:

```sql
SELECT COUNT(*) FROM ai_response_cache
WHERE prompt_id = '<prompt_id>'
  AND prompt_version = '<prompt_version>'
  AND expires_at > NOW();
```

Should return 0.

Watch `platform_ai_cache_hits_total{prompt="<prompt_id>"}` in Grafana — it should drop to near-zero immediately after invalidation and recover as new responses are cached over the following hours.

---

## Step 4: Ad-Hoc Cache Bypass for Investigation

To bypass the cache for a single generation without invalidating shared entries, pass `cacheControl: 'bypass_cache'` in `GenerateInput`:

```typescript
const result = await generationService.generate({
  ctx,
  promptId: 'intent_capture.extract_goals',
  inputs: { conversation, domainContext },
  cacheControl: 'bypass_cache',
});
```

This forces a fresh provider call for this invocation only. The new response is **not** written back to the cache when `bypass_cache` is set. Use this for:

- Debugging quality issues without poisoning the cache with investigation artifacts
- Running determinism verification (`PROMPT_TEST_DETERMINISM=true`)
- Manual testing of a fixed prompt before bumping its version

To force cache-only (fail if no cache entry, never call the provider):

```typescript
cacheControl: 'cache_only';
```

This is useful for verifying that a specific input is cached before relying on it in a test.

---

## Step 5: Monitor Cache Hit Rate After Invalidation

After invalidation, expect an elevated cache miss rate until the cache is repopulated. Monitor:

```sql
SELECT
  date_trunc('hour', created_at) AS hour,
  prompt_id,
  COUNT(*) FILTER (WHERE cached = true) AS hits,
  COUNT(*) FILTER (WHERE cached = false) AS misses,
  ROUND(COUNT(*) FILTER (WHERE cached = true) * 100.0 / NULLIF(COUNT(*), 0), 1) AS hit_rate_pct
FROM ai_usage_records
WHERE prompt_id = '<prompt_id>'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour, prompt_id
ORDER BY hour DESC;
```

For a high-traffic prompt, the hit rate should recover within 1-2 hours. For low-traffic prompts, recovery may take a day.

**Expect a temporary cost increase** during the miss period. Communicate this to workspace admins if they are near their monthly budget.

---

## Step 6: Prevent Stale Cache Entries from Accumulating

The TTL expiry job runs on a configurable schedule (default: every 6 hours) and deletes entries where `expires_at < NOW()`. Confirm the job is running:

```bash
GET /api/v1/admin/jobs/ai-cache-cleanup
Authorization: Bearer <admin_token>
```

If the job has not run in > 12 hours, trigger it manually:

```bash
POST /api/v1/admin/jobs/ai-cache-cleanup/run
Authorization: Bearer <admin_token>
```

If storage for `ai_response_cache` is unexpectedly large, check for entries with very long TTLs:

```sql
SELECT
  prompt_id,
  prompt_version,
  COUNT(*) AS entries,
  MAX(expires_at) AS max_expiry
FROM ai_response_cache
WHERE expires_at > NOW() + INTERVAL '7 days'
GROUP BY prompt_id, prompt_version
ORDER BY max_expiry DESC;
```

Prompts with TTLs beyond 24 hours should have explicit justification in their `modelConfig.cacheTtlSeconds` property. The default is 86400 (24 hours).

---

## Key Facts

- The cache key hash is computed from `(provider, model, system_prompt, user_prompt, parameters)`. Any change to any of these components produces a new cache key. Prompt version bumps automatically shift to new cache keys.
- Cache entries with `expires_at` in the past are immediately inactive — the lookup query filters by `expires_at > NOW()`. Hard deletion happens on the next cleanup job run.
- Cache hits do **not** count against the workspace's token budget. They cost only platform storage.
- The `unique: [cache_key_hash]` constraint on `ai_response_cache` means concurrent generation requests for the same input will race to write the first result; subsequent writes are silently discarded. This prevents duplicate cache entries but means the second caller gets a fresh response on the same call if the first has not cached yet.
