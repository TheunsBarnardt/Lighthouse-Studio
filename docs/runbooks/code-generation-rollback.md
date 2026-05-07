# Runbook: Rolling Back a Deployed Function

## When to use

- A deployed function is causing errors in production
- A customer approved a function with a bug and needs to revert
- A regeneration worsened the function; the prior version was better

## Steps

1. Via the UI (preferred for customers):
   - Open Stage 7 Code Review
   - Select the function
   - Click **↩ Rollback** in the toolbar
   - Select the target version from the version history
   - Confirm the rollback

2. Via the API (for platform team or automation):
   ```
   POST /api/code-generation/functions/<function-id>/rollback
   Authorization: Bearer <token>
   Content-Type: application/json
   
   { "targetVersion": 2 }
   ```
   Response includes the new version number (always `current + 1`).

3. After rollback, the function must be redeployed (Stage 9 / deployment flow):
   - Rollback only changes the approved source; deployment happens separately
   - If the function is already in production, a quick redeploy from Stage 9 is required

4. Verify rollback succeeded:
   - The function's version number increments in the UI
   - The `ai.code_generation.function_rolled_back` audit event appears in the audit log
   - The deployed version matches the expected source

## Notes

- Rollback creates a NEW version with the prior version's content; the current version is preserved
- All versions are available for future inspection
- A rollback that was itself rolled back creates another version increment (v1 → v2 → v1-content as v3 → v2-content as v4, etc.)
