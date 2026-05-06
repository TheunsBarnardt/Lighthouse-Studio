# ADR-0155: Caching AI Responses

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

AI provider calls are expensive and slow. A single generation step can cost $0.10–$2.00 and take 5–30 seconds depending on context length and provider. During development, developers frequently re-run the same pipeline stage with the same inputs — iterating on downstream steps, debugging, or reviewing output. Without caching, every re-run charges full cost and adds full latency.

Deterministic prompts (temperature: 0) with identical inputs produce identical or near-identical outputs. Caching these responses is both safe and highly valuable: the second run is instant and free.

The cache must be coherent at the workspace level. Two users in the same workspace running the same stage on the same artifact should share the cache. Cache hits must not count against the workspace token budget. The cache must be bypassable when developers want a fresh response.

## Decision

AI response caching is implemented via an `ai_response_cache` table with a computed cache key. The cache key is the SHA-256 hash of:

```
(provider_id, model_id, system_prompt_text, user_prompt_text, serialized_parameters)
```

Parameters included in the hash: `temperature`, `max_tokens`, `top_p`, `tool_choice`, and any provider-specific sampling parameters. The cache entry stores the full serialized response, the token counts, and the UTC expiry timestamp.

Default TTL is 24 hours. Individual prompts can declare a shorter TTL or disable caching entirely via `cacheControl` in `definePrompt`. The cache is shared across the workspace; user identity is not part of the cache key because prompt inputs already encode workspace-scoped context.

Cache hits bypass the token budget check and decrement: a cache hit costs $0 and does not count against the monthly budget. Cache misses go through the normal budget check before calling the provider.

Callers can explicitly bypass the cache by setting `bypassCache: true` on a `GenerateRequest`. This is surfaced in the UI as a "refresh" action on any generated artifact.

## Consequences

**Easier:**

- Repeat runs during development are instant and free, which dramatically improves iteration speed for prompt authoring and pipeline debugging
- The CI determinism job (ADR-0159) uses `bypassCache: true` to force fresh calls; the cache does not interfere with variance testing
- Cost tracking remains accurate: cache hits are recorded as $0 entries in `ai_usage_records`, giving a true picture of provider costs versus cache savings

**Harder:**

- Cache invalidation: if the underlying model changes behavior (provider-side update to a named model like `gpt-4o`) without a model version change, cached responses may be stale; mitigated by including the full model identifier (with version where providers expose it) in the cache key
- The `ai_response_cache` table can grow large; a background job must purge expired entries; MongoDB TTL indexes and PostgreSQL scheduled deletes handle this differently per adapter
- The cache is workspace-scoped but not user-scoped; a cached response visible to one user is visible to all workspace members; this is intentional but must be documented for workspaces with sensitive generation contexts

**Alternatives Considered:**

- **No caching; rely on provider prompt caching (e.g., Anthropic's cache_control):** Provider-side caching reduces latency but not cost proportionally; it does not survive across sessions or provide cross-user sharing; rejected as insufficient on its own
- **Redis/Valkey for the response cache:** In-memory cache for lower latency; rejected — the platform already requires a relational database per workspace; adding Redis as a required dependency increases operational complexity; 24-hour TTL responses are not latency-sensitive enough to justify it; the database cache is simpler and self-contained
- **Per-user cache instead of per-workspace:** Would prevent sharing cache hits between workspace members; rejected — prompt inputs already contain workspace-scoped artifact IDs; the cache is effectively per-workspace even if keyed only on prompt content
