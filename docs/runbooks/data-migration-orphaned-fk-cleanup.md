# Runbook: Orphaned FK After Migration

**Trigger:** FK integrity validation fails post-migration; target rows reference non-existent parent rows.

## Symptoms

- `fk_integrity` validation check shows violations
- Example: `orders.customer_id` references a customer UUID that doesn't exist in the `users` table

## Investigation

### 1. Find the orphaned FKs

```sql
SELECT o.id, o.customer_id
FROM orders o
LEFT JOIN users u ON u.id = o.customer_id
WHERE u.id IS NULL
LIMIT 100;
```

### 2. Check the mapping

Review the migration plan's FK resolution strategy:
- Was `resolve_by_natural_key` used? Check if the natural key lookup found all source rows.
- Was a junction table properly populated before the child table?

### 3. Check the source

Did the source itself have orphaned FKs (parent rows were deleted without cascading to children)?

## Remediation

### Option A: Rollback and fix the mapping

If the orphan count is large or systematic:
1. Roll back to snapshot
2. Fix the FK resolution transformation (add the missing natural key mapping, correct the lookup table)
3. Re-execute

### Option B: Manual cleanup in target

If the orphan count is small (< 100 rows):
1. Accept the migration validation with known failures
2. Use the Schema Designer's Data Browser to manually fix the orphaned rows
3. Set FK columns to a known parent or NULL (if nullable)
4. Re-run FK integrity validation manually

### Option C: Soft-delete pattern

If the source had intentional orphans (child rows referencing deleted parents), add a sentinel "deleted" parent row and map the orphans to it.

## Prevention

- Include FK integrity in the sample preview — show FK mismatches before full execution
- Log FK resolution failures per row so orphans are visible before they accumulate
