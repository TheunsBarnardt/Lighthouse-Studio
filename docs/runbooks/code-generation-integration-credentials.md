# Runbook: Managing Third-Party Integration Credentials

## Symptoms

- Function failing with `INTEGRATION_ERROR: 401 Unauthorized`
- Customer reports Stripe/SendGrid/Twilio functions not working
- Secret rotation needed after a credential exposure

## Steps

1. **View configured secrets** for a workspace (admin only, values redacted):
   ```
   GET /internal/workspaces/<id>/secrets
   ```
   Confirms which secret names are configured and their last-rotated date.

2. **Customer rotates a secret** via Settings → Integrations → [integration name]:
   - Enter the new API key
   - Click Save
   - The platform stores the value in the SecretStorePort (never in the database directly)
   - Running functions pick up the new secret on the next invocation (no redeployment needed)

3. **Verify the new secret works**: trigger a test invocation of the affected function:
   ```
   POST /api/code-generation/functions/<id>/invoke
   { "input": { "test": true } }
   ```

4. **If a secret was exposed** (committed to git, shared in a message, etc.):
   - Revoke the old credential in the third-party provider immediately
   - Create a new credential
   - Rotate the platform secret (step 2)
   - Review audit events for any invocations using the old credential
   - File an incident report if the exposure window exceeded 1 hour

5. **Secrets declared by a function** must match the workspace's configured secrets. If a function declares `stripeApiKey` but the workspace has `stripe_api_key` (different name), the function fails validation:
   - Either update the function's manifest (regenerate with correct secret name)
   - Or rename the workspace secret to match

## Prevention

- Rotate secrets annually or after team member departure
- Never pass secrets as function inputs or return them in function outputs
- The static analyzer catches `process.env` access; secrets via `ctx.secrets` are the only approved pattern
