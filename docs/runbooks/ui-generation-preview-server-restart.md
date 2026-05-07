# Runbook: UI Generation Preview Server Not Responding

## Symptoms

- Preview iframe shows blank or connection refused
- `GET /preview/<session-id>` returns 502 or times out
- Customer reports "Live Preview unavailable"

## Steps

1. Check preview server health:
   ```
   GET /internal/preview-servers
   ```
   Confirm session entry exists and `status === 'running'`.

2. If `status === 'crashed'` or entry missing, restart the session's preview server:
   ```
   POST /internal/preview-servers/<session-id>/restart
   ```

3. If the restart fails, check disk space — Vite writes a `.vite` cache directory per session. Clear stale caches older than 2 hours:
   ```
   platform admin preview-cache purge --older-than 2h
   ```

4. If disk is healthy, check the preview server log:
   ```
   platform logs preview-server --session <session-id> --tail 200
   ```
   Look for `ENOMEM` (OOM) or missing npm packages (incomplete export bundle).

5. If OOM: reduce `UI_GENERATION_PREVIEW_MAX_SESSIONS` in environment config and restart the platform.

## Prevention

- Default session idle timeout is 30 minutes; adjust `UI_GENERATION_PREVIEW_IDLE_TIMEOUT_MINUTES` if sessions are being evicted too aggressively.
- Monitor `ui_generation_preview_server_restarts_total` Prometheus metric.
