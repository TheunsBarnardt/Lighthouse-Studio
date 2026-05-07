# ADR-0264: Two-Phase CSV/JSON Import for the Data Browser

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 18 (Data Browser & Editor)

---

## Context

The data browser needs to let workspace admins import rows from CSV or JSON files. Imports can be large (tens of thousands of rows). We need to decide how the import UX and pipeline are structured.

Two approaches:

1. **Single-shot import** — user selects a file, clicks Import, rows are written immediately. Simple but risky: if the file has bad data, some rows may be written before the error is detected.

2. **Two-phase import (preview then commit)** — Phase 1 parses and validates a sample of the file client-side and presents a preview. The user reviews column mapping and validation errors before committing. Phase 2 sends the file to a background import job that writes rows with server-side validation.

---

## Decision

Use a **two-phase import**: **preview** then **commit**.

**Phase 1 — Upload & Preview (client-side)**
- File is parsed client-side using **PapaParse** (CSV) or `JSON.parse` (JSON).
- A sample of up to 100 rows is shown in a preview table.
- Column mapping is auto-detected and editable.
- Client-side type validation runs on the sample; validation errors are displayed inline.
- Row count is shown ("1,234 rows detected. 3 validation errors in sample.").

**Phase 2 — Import Job (server-side)**
- On Commit, the full file is submitted to a background import job API.
- The job validates every row against the schema, writes valid rows, and accumulates per-row errors.
- The user sees a progress indicator; on completion, a summary is shown (rows written, rows skipped with error reasons).

### Bounded limits

- Maximum file size: 50 MB.
- Maximum row count per import: 500,000 rows.
- Imports exceeding these limits are rejected at upload time with a clear error message.

---

## Consequences

**Positive:**
- Users see what will happen before data is written. Surprises (wrong column mapping, unexpected nulls, type mismatches) are caught before they pollute production data.
- PapaParse processes large CSV files in a Web Worker, keeping the UI responsive during Phase 1.
- Server-side validation in Phase 2 is authoritative; client preview is advisory.

**Negative:**
- Two-step UX requires more clicks than single-shot import.
- Large imports (> 50k rows) have preview based on a sample only — rare data quality issues in non-sampled rows may not surface until Phase 2.

**Neutral:**
- JSON import follows the same two-phase pattern. The preview shows the first N objects from the array.
- The 50 MB / 500k row limits can be raised per-workspace via the plan configuration (not in v1 scope).
