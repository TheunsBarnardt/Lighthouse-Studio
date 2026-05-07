# Runbook: Schema Synthesis Coverage Gaps

**Trigger:** Many synthesis runs show low entity coverage rates; users reporting "the AI missed important tables."

## Diagnosis

### 1. Check coverage rates in audit logs

```sql
SELECT meta->>'coverageRate' AS rate, created_at
FROM audit_events
WHERE event = 'ai.schema_synthesis.synthesis_completed'
ORDER BY created_at DESC LIMIT 100;
```

If `coverageRate` is consistently below 0.8, the entity extraction prompt is under-extracting.

### 2. Identify which entities are being missed

Look at `prdEntitiesUncovered` in synthesis artifacts. Are there patterns?
- Junction tables being missed (e.g., `post_tags`)
- Lookup tables being missed (e.g., `statuses`, `categories`)
- Dependent entities being missed (e.g., `order_line_items`)

### 3. Test the entity extraction prompt

Run the entity extraction prompt against a representative PRD and inspect the output:

```typescript
const result = await generation.run('schema-synthesis.entity-extraction', {
  prdContent: '...', projectType: 'CRM', targetUsers: 'sales teams'
});
console.log(result.value.entities);
```

Check if the entities list is too short or if implicit entities (junction tables, audit logs) are missing.

## Remediation

### Option A: Update entity extraction system prompt

If junction tables and lookup tables are consistently missed, update the system prompt to explicitly instruct the AI to:
- Identify implicit junction tables for many-to-many relationships
- Identify lookup/reference tables for enumerable values
- Identify audit/event tables if the PRD mentions activity tracking

### Option B: Add a post-extraction enrichment prompt

Add a second pass that reviews the extracted entities and identifies likely missing ones:

```
"Given these entities [X, Y, Z] and these relationships, what junction tables or lookup tables are likely missing?"
```

### Option C: Improve PRD context

The entity extraction prompt receives the full PRD content. If PRDs are written in ways that make entities implicit, update the extraction prompt to better handle implicit entities from user stories.

## Prevention

- Monitor `coverageRate` metric in Grafana; alert when workspace average drops below 0.75
- Run the entity extraction golden test suite against PRD fixtures after each prompt update
