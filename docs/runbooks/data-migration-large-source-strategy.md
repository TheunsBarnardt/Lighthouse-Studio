# Runbook: Large Source Dataset Strategy

**Trigger:** Migration source has > 10M rows or > 50GB; standard batch size is too slow or hits memory limits.

## Symptoms

- ETA projection shows migration will take > 12 hours
- Source streaming hits memory limits in the adapter
- Target bulk-insert is bottlenecked on row count

## Investigation

Check the source size:
```sql
SELECT source_table_id, row_count
FROM migration_source_tables
WHERE execution_id = '<execution-id>'
ORDER BY row_count DESC;
```

Identify which tables are the bottleneck.

## Remediation

### Option A: Increase batch size

For large tables with simple transformations (no custom JS), increase `batchSize` to 5,000 or 10,000 in the migration plan. Monitor memory usage.

### Option B: Split the migration into phases

For very large tables:
1. Add a `rowFilter` to the table mapping to migrate a date range or ID range in the first run
2. Execute the first migration for e.g. rows where `created_at < '2023-01-01'`
3. Execute a second migration for the remaining rows
4. Combine in the target

Note: phased migrations require careful ordering to avoid FK violations.

### Option C: Parallel table migration

If the source has multiple independent large tables, run separate migration plans per table. This distributes load across executor workers.

### Option D: Pre-aggregate at source

For tables being aggregated (e.g., event logs → summary rows), run the aggregation at the source first (export a materialized view or temp table), then migrate the aggregated result. This dramatically reduces the row count.

## Prevention

- Show estimated migration time in the approval step (based on row count and historical migration throughput)
- Warn when estimated time > 6 hours; suggest one of the strategies above
- Default batch size remains 1,000 for safety; document that larger batches are available for large sources
