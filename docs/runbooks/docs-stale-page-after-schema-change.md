# Runbook: Documentation Page Stale After Schema Change

**Severity:** Low
**Trigger:** A schema migration ran but a documentation page still shows old field information

---

## Symptoms

- A field was added or removed from a schema entity
- The corresponding docs page still shows the old field list
- The page's "Updated" timestamp is older than the schema migration

---

## Diagnosis

1. Check whether the sync trigger fired after the schema migration:
   - Look for a `DOC_PAGE_SYNCED` audit event after the migration timestamp
   - If no event: the sync trigger was not fired or failed silently

2. Check whether the affected page exists in the docs:
   - If no page exists for the entity, it was never generated — this is a generation gap, not a stale page

---

## Resolution

### Manual re-sync

Trigger a manual re-sync for the affected entity via the platform:
1. Open **Project Docs** → locate the entity page
2. Click the page's context menu → **Sync from source**
3. Verify the field table updates within 10 seconds

### Via API

```bash
POST /api/docs/sync
{
  "appId": "<app-id>",
  "trigger": {
    "sourceType": "schema",
    "sourceId": "<entity-id>",
    "changeDescription": "Manual resync after migration"
  }
}
```

---

## Prevention

- Schema migration events should always emit a `DOC_PAGE_SYNCED` trigger — verify the event pipeline is wired
- Add a health check that alerts if no doc sync occurred within 30 minutes of a schema migration
