# Runbook: Schema Synthesis Database Mismatch

**Trigger:** Synthesis produces schemas with features unsupported by the workspace's database (e.g., array columns on MSSQL, or SQL FKs on MongoDB).

## Symptoms

- Schema validation in Schema Designer fails after synthesis is applied
- User reports "the AI used features my database doesn't support"
- `naming-validation` prompt or Schema Designer flags capability violations

## Investigation

### 1. Check what driver was used

```sql
SELECT meta->>'databaseDriver' AS driver
FROM audit_events
WHERE event = 'ai.schema_synthesis.synthesis_completed'
AND meta->>'artifactId' = '<id>';
```

### 2. Check the capability context used

In `DEFAULT_CAPABILITY_CONTEXTS` in `packages/core/src/services/ai/schema-synthesis/types.ts`, verify the capability flags for the driver. If `arrayColumns: false` for MSSQL, the table generation prompt should not produce array columns.

### 3. Check prompt compliance

If the capability context is correct, the prompt may be ignoring the capability flags. Test:

```typescript
const result = await generation.run('schema-synthesis.table-generation', {
  entityName: 'Tags',
  databaseDriver: 'mssql',
  capabilities: { arrayColumns: false, jsonColumns: true, foreignKeysEnforced: true },
  // ...
});
// Inspect: does output contain any array-type columns?
```

## Remediation

### Prompt constraint violation

If the AI generates array columns despite `arrayColumns: false`, strengthen the system prompt:

```
"CRITICAL: arrayColumns is false. You MUST NOT use array types (text[], int[], etc.). 
For many-to-many relationships, use a junction table."
```

### Capability context mismatch

If the capability context in `DEFAULT_CAPABILITY_CONTEXTS` is wrong (e.g., a new database version added a feature), update the capability flags.

### Post-generation validation

Add a post-synthesis capability check to `SchemaSynthesisService` that scans all generated columns for capability violations before returning the artifact. This acts as a safety net even if the prompt produces violations.

## Prevention

- Add a test that generates a schema with `arrayColumns: false` and asserts no array-type columns appear
- Run capability-specific tests for all three drivers in CI
