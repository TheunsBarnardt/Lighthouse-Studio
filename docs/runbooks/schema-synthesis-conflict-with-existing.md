# Runbook: Schema Synthesis Conflict With Existing Schema

**Trigger:** Synthesis diff mode proposes changes that conflict with the existing schema (e.g., proposing a new column that already exists with a different type).

## Symptoms

- Schema Designer shows a conflict indicator after synthesis is applied
- `diff-generation` prompt output has `modifiedTables` with column names that already exist
- The Schema Designer's merge tool shows conflicts between synthesized and existing columns

## Investigation

### 1. Check what the diff proposed

In the synthesis artifact, inspect `synthesizedSchema.diff`:

```typescript
console.log(artifact.synthesizedSchema.diff?.modifiedTables);
// Look for: same column name, different type, or same column name appearing in both existing and proposed
```

### 2. Check if the diff generation prompt received the existing schema

The `diff-generation` prompt should receive `existingTables` with all current column names. If this list is empty or incomplete, the AI doesn't know the column already exists.

### 3. Verify the existing schema was fetched correctly

In `SchemaSynthesisService._synthesizeSchema()`, the existing schema fetch uses `this.artifacts.getById(ctx, input.existingSchemaId)`. If the schema ID is wrong or the artifact fetch fails silently (returning the wrong schema), the diff sees a different "existing" schema.

## Remediation

### Option A: Re-run synthesis with correct context

If the existing schema was incorrectly fetched, fix the schema ID and re-run synthesis. The diff will correctly identify existing columns and not propose them again.

### Option B: Manual conflict resolution

In the Schema Designer, use the merge tool to resolve conflicts:
- For type conflicts: choose the existing type or the proposed type
- For extra columns: keep the existing column if it still applies; add proposed columns as new

### Option C: Defensive check in diff generation

Add a post-synthesis check that removes any "new column" proposals where a column with the same name already exists in the table. Surface them as "column already exists" warnings instead.

## Prevention

- Add an integration test that synthesizes against a workspace with an existing schema and verifies no duplicate column proposals
- Log when `existingSchemaId` is provided and `existingTables` in the diff input is empty — this is a data fetch issue
