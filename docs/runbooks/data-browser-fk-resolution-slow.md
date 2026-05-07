# Runbook: Data Browser — Foreign Key Resolution Slow

**Symptom:** The data browser takes a long time to display FK column values (e.g., user names instead of UUIDs). The grid shows raw IDs for several seconds after loading.

---

## 1. Identify Slow FK Columns

In the browser network tab, look for slow requests to `/api/v1/data/{ws}/schemas/{slug}/fk-resolve`. Note:

- Which `targetTableId` is slow.
- How many IDs are being resolved per call.
- Response time.

---

## 2. Check Indexes on Target Table

The FK resolver runs `SELECT id, <displayColumn> FROM <target_table> WHERE id IN (...)`. If the target table lacks a primary key index or the display column is unindexed, this scan is full-table.

```sql
-- In the customer schema (cust_<slug>)
\d <target_table>
-- Look for: indexes on id (should be PK), and on the display column if it's text-searched
```

If the primary key index is missing (unusual but possible after a bad migration):

```sql
CREATE UNIQUE INDEX CONCURRENTLY idx_<target_table>_id ON cust_<slug>.<target_table>(id);
```

---

## 3. Check Cardinality

If the FK target table has millions of rows, `WHERE id IN (...)` with 500 IDs should still be fast with a PK index. If it isn't:

```sql
EXPLAIN ANALYZE
SELECT id, name FROM cust_<slug>.<target_table>
WHERE id IN ('id1', 'id2', 'id3' /* sample 50 IDs */);
```

Look for `Seq Scan` — that means no index is being used. Add an index.

---

## 4. Check Table Row Count

If the display column (e.g. `name`) is text and the FK target table has > 1M rows, consider adding an index on the display column to support the search-as-you-type combobox:

```sql
CREATE INDEX CONCURRENTLY idx_<target_table>_name ON cust_<slug>.<target_table>(name text_pattern_ops);
```

---

## 5. Increase Client-Side Cache TTL

The FK label cache is session-scoped in the browser (no TTL, lasts until page reload). If FK resolution is happening more often than expected, check whether:

- The filter is changing frequently (page re-renders re-trigger FK resolution for new rows).
- The user is paginating rapidly.

These are expected behaviors; the cache prevents re-fetching already-resolved IDs.

---

## 6. Short-Term Mitigation

The data browser degrades gracefully: FK cells show the raw UUID while resolution is in progress. Users can still interact with the grid. The resolution request completes asynchronously and the labels appear without a grid refresh.

---

## Prevention

- Enforce primary key indexes in the schema migration framework.
- Add a performance check in the schema deploy process: warn if an FK target table has > 100K rows and no index on the display column.
- Monitor `/fk-resolve` P95 response time; alert if > 500ms.
