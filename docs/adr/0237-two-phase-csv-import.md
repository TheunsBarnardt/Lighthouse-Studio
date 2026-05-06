# ADR-0237: Two-Phase CSV/JSON Import

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 18 (Data Browser & Editor)

---

## Context

Importing CSV or JSON data into a customer table is a high-stakes operation: a bad import can corrupt data or create thousands of invalid rows. Users need to understand what will happen before it happens, and they need a sensible story for partial failures.

---

## Decision

**Two-phase import:**

1. **Upload & Preview phase**: the file is parsed client-side using `papaparse`. A sample (first 100 rows) is validated against the schema (types, required fields, FK existence). Column headers are auto-mapped to schema fields (case-insensitive). The UI shows a preview table, validation errors, and the column mapping for user confirmation or correction.

2. **Commit phase**: the user confirms. The platform uploads the file to storage (getting a `sourceFileId`), then enqueues an `ImportJob` via `DataBrowserService.startImport`. A background worker streams the CSV, validates, and inserts in batches of 1000 via the bulk-create API. Progress is polled; the user can leave the page and return.

**On-error policy** is user-selected at commit time: `skip` (import good rows, collect errors in a downloadable error.csv) or `fail` (rollback entirely if any row fails).

**Row limit:** 100,000 rows per import. Larger datasets use the query console or direct API.

---

## Consequences

**What becomes easier:**

- Users see exactly what will happen before committing.
- Background jobs mean the browser isn't blocked for large imports.
- Error reports are downloadable, not just displayed inline.

**What becomes harder:**

- Two round-trips (upload + enqueue) add latency before the import starts.
- Progress polling requires a `/api/v1/data/{ws}/browser/imports/{jobId}` endpoint.

---

## Alternatives Considered

- **Stream directly from browser to database:** Bypasses the bulk-create API, skipping authorization and audit. Rejected: anti-pattern explicitly listed in Objective 18.
- **Single-phase with inline progress:** Simpler, but the browser must stay open for the duration. Rejected: 100K-row imports can take minutes; background jobs are more robust.
- **Server-side file parsing only:** Avoids client-side papaparse, but delays feedback until after upload. Rejected: client-side preview is the key UX win.
