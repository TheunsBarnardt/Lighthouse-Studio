# Runbook: Project Export Failing

## Symptoms

- Export dialog shows "Export failed" error
- ZIP download is empty or corrupted
- GitHub push fails with authentication error
- `POST /api/ui-generation/projects/<id>/export` returns 4xx or 5xx

## Steps

1. Check export audit event for the error:
   ```sql
   SELECT payload->>'error' AS error
   FROM audit_events
   WHERE event_type = 'ui_generation.project_export_failed'
     AND payload->>'project_id' = '<project-id>'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

2. Common error → remediation:

   | Error | Action |
   |-------|--------|
   | `no_approved_components` | Customer must approve at least one component before exporting |
   | `artifact_storage_write_failed` | Check artifact storage connectivity and disk space |
   | `github_token_expired` | Customer must re-authorise GitHub integration via Settings → Integrations |
   | `zip_assembly_timeout` | Project has unusually many large components; retry once; if persistent, increase `UI_GENERATION_EXPORT_TIMEOUT_SECONDS` |

3. If artifact storage write failed, check storage health:
   ```
   platform health artifact-storage
   ```

4. Manually trigger re-export (admin only):
   ```
   platform admin ui-generation export --project-id <id> --format zip
   ```

## Prevention

- Monitor `ui_generation_export_failures_total` by `reason` label.
- Alert when `artifact_storage_write_failed` reason appears > 3 times in 5 minutes.
