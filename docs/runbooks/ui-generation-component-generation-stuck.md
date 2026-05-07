# Runbook: Component Generation Stuck / Not Progressing

## Symptoms

- Progress indicator frozen for > 5 minutes on a single component
- `UiProjectArtifact.status` stays `generating` indefinitely
- No audit event written for the component in > 5 minutes

## Steps

1. Identify the stalled component:
   ```
   SELECT id, name, status, updated_at
   FROM ui_project_artifacts
   WHERE project_id = '<project-id>'
     AND status = 'generating'
     AND updated_at < NOW() - INTERVAL '5 minutes';
   ```

2. Check the pipeline run associated with the artifact:
   - Look up `pipeline_run_id` on the artifact row
   - Check `pipeline_runs` table for status and error

3. If the pipeline run shows `error`, inspect the error message. Common causes:
   - **AI provider timeout** — retry the component via `POST /api/ui-generation/projects/<id>/components/<name>/regenerate`
   - **Token limit exceeded** — the component prompt hit the model's context limit; the schema may be too complex; see ADR-0192 for mitigation options
   - **Accessibility retry loop** — check if `a11y_retry_count > 1` on the artifact; if so, the component has persistent violations that require manual intervention

4. If the pipeline run is still `running` after 10 minutes, kill it:
   ```
   POST /internal/pipeline-runs/<run-id>/cancel
   ```
   Then mark the artifact as `draft` and allow the customer to retry.

5. If multiple components are stuck simultaneously, check AI provider status pages and workspace budget:
   ```
   GET /api/workspaces/<id>/ai-usage
   ```

## Prevention

- `UI_GENERATION_COMPONENT_TIMEOUT_SECONDS` defaults to 300 (5 min); increase if generation is consistently timing out on large schemas.
- Monitor `ui_generation_component_generation_duration_seconds` p99 histogram.
