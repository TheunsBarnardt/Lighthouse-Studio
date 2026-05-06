# Runbook: AI PII Leak Incident Response

**Audience:** Platform operators, security team, data protection officer
**Relates to:** Objective 20 (ADR-0154), Objective 7 (personal data registry)

---

## Overview

A PII leak incident occurs when personally identifiable information — names, email addresses, phone numbers, or any column registered in the personal data registry — was included in a rendered prompt sent to a third-party AI provider without explicit workspace consent. The platform's mandatory redaction layer is designed to prevent this, but a configuration error, a registry gap, or a code defect could bypass it.

**This is a data breach candidate. Escalate to the data protection officer immediately if customer PII reached a third-party provider.**

Time matters. Work through these steps in order without skipping.

---

## Step 1: Detect the Incident

### Via the `ai.generation.started` audit event

Every generation emits an `ai.generation.started` event. The event metadata includes:

- `prompt_id` and `prompt_version`
- `workspace_id` and `user_id`
- `redaction_applied: boolean`
- `pii_redaction_override_consent: boolean` (from `ai_workspace_config`)

A PII leak is suspected when `redaction_applied = false` and `pii_redaction_override_consent = false` for a workspace that has PII columns in scope.

Query for this condition:

```bash
GET /api/v1/admin/audit?event=ai.generation.started&from=<incident_window_start>
Authorization: Bearer <admin_token>
```

Filter the results for records where `metadata.redaction_applied = false` and `metadata.pii_redaction_override_consent = false`.

### Via the `redactionLog` in rendered prompts

The `RenderedPrompt` object carries a `redactionLog: RedactionRecord[]` that lists every value that was redacted and what it was replaced with. If a generation's `redactionLog` is empty but the prompt inputs included PII-tagged columns, redaction was bypassed.

Check recent prompt render logs:

```
[WARN] prompt.service: redactionLog is empty for prompt <prompt_id>; inputs included PII columns [email, phone_number]
```

### Via `platform_ai_pii_redactions_total{category}` metric

If this counter has been near-zero for a prompt or stage that is known to process PII columns, redaction may have silently failed.

---

## Step 2: Containment — Disable AI Generation for Affected Workspace

Before investigating, stop the bleeding. Disable AI generation for the affected workspace immediately:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "ai_generation_enabled": false
}
```

This causes all subsequent `GenerationService.generate` calls for the workspace to return a `ServiceUnavailableError` without reaching the provider.

Confirm the disablement is effective by checking that `ai.generation.started` events stop appearing for the workspace in the audit log.

---

## Step 3: Containment — Rotate Provider Credentials

If the leak involved a provider key that could be used to query the provider's logs or request history, rotate it immediately via `SecretStorePort`.

The workspace's provider credentials are stored as encrypted references in `ai_workspace_config.custom_provider_credentials`. Do not read raw secrets from this column — it contains references into the secret store, not the secrets themselves.

**For workspace-specific (customer-managed) keys:**

Contact the workspace admin and instruct them to rotate their provider API key directly in the provider's console (Anthropic console / OpenAI platform). Then update the stored reference:

```bash
POST /api/v1/admin/workspaces/<workspace_id>/provider-credentials/rotate
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "provider": "anthropic",
  "new_secret_reference": "<new_secret_id_from_secret_store>"
}
```

**For platform-level default keys:**

Rotate these via the platform's secret rotation process documented in `secret-rotation.md`. Do not store them anywhere except `SecretStorePort`.

---

## Step 4: Determine Scope of the Leak

### What was sent?

Retrieve the audit events for the affected time window and extract prompt inputs from the `ai.generation.started` metadata. The event stores:

- `prompt_id`, `prompt_version` — which prompt was used
- `inputs_hash` — a hash of the rendered prompt inputs (not the raw values)
- `redactionLog` — what was and was not redacted

Cross-reference with the prompt's input schema (in the prompt TypeScript file) to understand what PII fields are in scope.

### Which provider received it?

Check `ai_usage_records` for the workspace during the incident window:

```sql
SELECT DISTINCT provider, model, created_at
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND created_at BETWEEN '<incident_start>' AND '<incident_end>'
ORDER BY created_at DESC;
```

The `provider` value tells you which third party received the data. Contact that provider's privacy/security team to request log deletion if their policies allow it.

### How many records were affected?

```sql
SELECT COUNT(*) AS affected_generations, COUNT(DISTINCT user_id) AS affected_users
FROM ai_usage_records
WHERE workspace_id = '<workspace_id>'
  AND created_at BETWEEN '<incident_start>' AND '<incident_end>'
  AND cached = false;
```

Only non-cached generations (`cached = false`) reached the provider. Cached generations were served from the `ai_response_cache` table — provider never saw those inputs.

---

## Step 5: Identify the Root Cause

Check each layer of the redaction pipeline:

### Personal data registry gap

A PII column may not have been registered in the personal data registry (Objective 7). Query the registry:

```bash
GET /api/v1/admin/personal-data-registry?workspace_id=<workspace_id>
```

If the column carrying PII is absent, that is the root cause. Register it and re-audit all prompts that reference that column.

### Prompt input bypassed the registry check

The `PromptService.render` method applies redaction by looking up each input field against the personal data registry. If a prompt's input schema uses a field name that is not directly mapped to a registered column (e.g., the prompt accepts raw text that the caller concatenated from multiple PII columns), redaction cannot fire.

Inspect the prompt file at the version that was running during the incident:

```bash
git show <commit_sha>:packages/core/src/ai/prompts/<stage>/<name>.prompt.ts
```

Check whether inputs contain free-text fields (`z.string()`) that callers may populate with PII values. These are redaction blind spots — they must be handled by the caller passing only non-PII summaries, or by adding explicit redaction at the call site.

### `pii_redaction_enabled` was false

Check the workspace config at the time of the incident (the `ai.budget.updated` audit event captures config changes with a before/after diff):

```sql
SELECT pii_redaction_enabled, pii_redaction_override_consent
FROM ai_workspace_config
WHERE workspace_id = '<workspace_id>';
```

If `pii_redaction_enabled = false` and `pii_redaction_override_consent = false`, this configuration is illegal and must be corrected. The platform should not permit this combination. If it does, that is a code defect — file a security issue immediately.

---

## Step 6: Remediation

1. **Fix the root cause** identified in Step 5. If it is a code defect, the fix goes through the normal PR process — do not bypass review even for security fixes, as review may catch additional issues.

2. **Re-enable AI generation** for the workspace once the fix is deployed and verified:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
{
  "ai_generation_enabled": true
}
```

3. **Invalidate cached responses** for the affected prompt/version that may contain unredacted values in the cache. See `ai-cache-invalidation.md`.

4. **Add a PII test case** to the affected prompt's test suite that includes a PII-tagged input and asserts the output does not contain the raw value.

---

## Step 7: Notification

### Internal notification

Brief the data protection officer and engineering lead within 1 hour of confirming the incident.

### Workspace admin notification

Notify the workspace admin what PII categories were involved, which provider received them, the time window, and what remediation steps were taken.

### Regulatory notification

If the incident meets the threshold for mandatory reporting under applicable privacy regulations (GDPR Article 33, POPIA Section 22, etc.), the data protection officer initiates the regulatory notification process. Do not delay this step waiting for the full root cause report.

---

## Key Facts

- `redactionLog` in the `RenderedPrompt` is the primary evidence of what was and was not redacted. Preserve it before cache or log rotation clears it.
- Cached responses (`ai_response_cache`) did **not** involve a provider call. PII in cache inputs is still a concern, but the provider did not receive it.
- Self-hosted providers (Ollama, vLLM on the customer's own infrastructure) are exempt from mandatory redaction. If the affected workspace uses self-hosted providers, the PII did not leave the customer's environment.
- Redaction is applied in `PromptService.render`, before `GenerationService` sends to the provider. If the `redactionLog` is populated but the wrong fields were redacted, the registry mapping is the likely defect.
