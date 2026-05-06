# Runbook: AI Provider Credential Rotation

**Audience:** Platform operators, workspace admins
**Relates to:** Objective 20 (ADR-0151), Objective 5 (SecretStorePort)

---

## Overview

AI provider credentials (API keys) for each workspace are stored as encrypted references in `ai_workspace_config.custom_provider_credentials`. The actual secrets live in `SecretStorePort` — never in the database in plaintext. This runbook covers rotating those credentials without service interruption.

There are two classes of credentials:

1. **Workspace-specific keys** — provided by the workspace admin using their own provider account; stored per-workspace in `SecretStorePort`
2. **Installation-default keys** — platform-level keys used when a workspace has no custom credentials; documented in `secret-rotation.md`

This runbook covers workspace-specific keys. For installation-default keys, follow `secret-rotation.md`.

---

## Step 1: Confirm the Current Key Reference

Retrieve the current credential reference for the workspace. Do not attempt to read the raw key — you will only see the reference ID.

```bash
GET /api/v1/admin/workspaces/<workspace_id>/ai-config
Authorization: Bearer <admin_token>
```

Response includes:

```json
{
  "workspace_id": "...",
  "primary_provider": "anthropic",
  "fallback_provider": "openai",
  "custom_provider_credentials": {
    "anthropic": {
      "secret_reference": "secret_<id>",
      "created_at": "2025-11-15T09:00:00Z",
      "rotated_at": null
    }
  }
}
```

Note the `secret_reference` value. This is the identifier in `SecretStorePort`. You will need it in Step 4 to deprecate the old key.

---

## Step 2: Generate the New Key

Generate a new API key from the provider's console:

- **Anthropic:** https://console.anthropic.com/settings/keys → Create Key
- **OpenAI:** https://platform.openai.com/api-keys → Create new secret key
- **Azure OpenAI:** Azure portal → Resource → Keys and Endpoint → Regenerate Key 2 (keep Key 1 active during rotation)
- **AWS Bedrock:** IAM → Users/Roles → Security credentials → Create access key

Copy the new key immediately — most providers show it only once.

---

## Step 3: Write the New Key to SecretStorePort

Store the new key via the platform's secret management API. This call writes the key into `SecretStorePort` and returns a new `secret_reference` ID:

```bash
POST /api/v1/admin/workspaces/<workspace_id>/secrets
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "type": "ai_provider_key",
  "provider": "anthropic",
  "value": "<new_api_key>"
}
```

Response:

```json
{
  "secret_reference": "secret_<new_id>",
  "created_at": "2026-05-06T12:00:00Z"
}
```

Do not store the `value` anywhere after this call. The key is now in `SecretStorePort`; the reference ID is what you use going forward.

---

## Step 4: Update the Workspace Config to Use the New Reference

Point the workspace to the new credential reference:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "custom_provider_credentials": {
    "anthropic": {
      "secret_reference": "secret_<new_id>"
    }
  }
}
```

The `GenerationService` reads credentials fresh from `ai_workspace_config` on each call (no in-process caching of credentials). The new key is effective immediately.

---

## Step 5: Verify the New Key Works

Run a health check against the workspace's AI configuration to confirm the new key authenticates successfully:

```bash
POST /api/v1/admin/workspaces/<workspace_id>/ai-config/health-check
Authorization: Bearer <admin_token>
```

This calls `AIProviderPort.healthCheck()` for each configured provider using the workspace's credentials. A successful response:

```json
{
  "anthropic": { "status": "healthy", "latency_ms": 142 },
  "openai": { "status": "healthy", "latency_ms": 98 }
}
```

If the health check returns `{ "status": "auth_failed" }`, the new key is incorrect or has not propagated at the provider. Re-check the key value and retry.

---

## Step 6: Deprecate the Old Key

Once the new key is verified:

1. **Revoke the old key at the provider.** Go to the provider's console and delete or revoke the old key. This ensures it cannot be used even if the reference is still accessible.

2. **Remove the old secret reference from SecretStorePort:**

```bash
DELETE /api/v1/admin/workspaces/<workspace_id>/secrets/secret_<old_id>
Authorization: Bearer <admin_token>
```

This marks the old secret as deprecated in `SecretStorePort`. Depending on the store implementation, this may schedule deletion after a retention period — do not assume the secret is immediately destroyed.

3. **Confirm the old reference is no longer in the workspace config** by running the `GET /api/v1/admin/workspaces/<workspace_id>/ai-config` call from Step 1 and verifying only `secret_<new_id>` appears.

---

## Step 7: Confirm Normal Operation

Monitor the workspace for 15 minutes after rotation:

- `platform_ai_provider_failures_total{provider="<provider>"}` should not increase
- `platform_ai_generations_total{workspace="<workspace_id>", status="succeeded"}` should continue incrementing normally
- `ai.generation.started` and `ai.generation.completed` audit events should appear as expected

If `platform_ai_provider_failures_total` spikes after rotation, the new key may be invalid or the workspace config update did not propagate. Roll back by re-applying the old `secret_reference`:

```bash
PATCH /api/v1/admin/workspaces/<workspace_id>/ai-config
{
  "custom_provider_credentials": {
    "anthropic": {
      "secret_reference": "secret_<old_id>"
    }
  }
}
```

Do not revoke the old provider key until you have confirmed the new one is working.

---

## Rotation Schedule

Recommended credential rotation frequency:

| Trigger                                         | Action                                 |
| ----------------------------------------------- | -------------------------------------- |
| Routine security policy (e.g., every 90 days)   | Full rotation via this runbook         |
| Suspected key exposure                          | Immediate rotation; treat as incident  |
| Team member with key access departs             | Rotate within 24 hours                 |
| Provider requests rotation (deprecation notice) | Rotate before the deprecation deadline |

---

## Key Facts

- Credentials stored in `ai_workspace_config.custom_provider_credentials` are encrypted references, not raw keys. The column contains JSON with `secret_reference` IDs pointing into `SecretStorePort`.
- `GenerationService` fetches credentials on each call — there is no in-memory credential cache that needs flushing after rotation.
- The platform's default installation keys are separate from workspace-specific keys. Rotating a workspace-specific key does not affect other workspaces or the installation defaults.
- For Azure OpenAI, rotate Key 2 while Key 1 is active, update the platform to use Key 2, then rotate Key 1 — this maintains zero-downtime rotation without disabling the resource.
