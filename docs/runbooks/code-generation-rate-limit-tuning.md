# Runbook: Adjusting Per-Function Rate Limits

## Symptoms

- Function returning 429 Too Many Requests for legitimate traffic
- Function being abused; too many requests from a single caller
- Customer reports rate limit is too tight or too loose

## Steps

1. Check the function's current rate limit in its manifest:
   ```
   GET /api/code-generation/functions/<id>
   ```
   Look at `manifestEntry.rateLimit.requestsPerMinute`.

2. View actual invocation rate over the past hour:
   ```
   GET /internal/functions/<id>/metrics?window=1h
   ```
   Field: `invocations_per_minute_p99` — compare to the limit.

3. Adjust the rate limit without regenerating:
   ```
   PATCH /api/code-generation/functions/<id>/manifest
   Authorization: Bearer <token>
   
   { "rateLimit": { "requestsPerMinute": 500, "burstLimit": 50 } }
   ```
   This updates the manifest only; requires a redeploy to take effect.

4. If the function is being abused (high rate from one client):
   - Check if the caller is authenticated and RBAC-scoped
   - Consider lowering `requestsPerMinute` temporarily
   - Investigate if this is a legitimately high-traffic function that needs a different architecture (e.g., queue-based processing instead of direct HTTP)

5. Default limits by trigger type (platform recommendation):
   - HTTP functions: 100 req/min (configurable)
   - Scheduled functions: rate limit not applicable (single invocation per schedule)
   - Event functions: no rate limit (triggered by platform events, bounded by event volume)
   - Manual functions: 10 req/min

## Prevention

- Set rate limits based on expected traffic during generation; the inventory step includes a `estimatedInvocationsPerDay` field that informs the default limit
- Monitor `function_rate_limit_hit_total` Prometheus metric per function
