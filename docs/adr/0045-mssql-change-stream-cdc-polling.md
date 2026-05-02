---
adr: 0045
title: MSSQL Change Streams — CDC Polling (Not Change Tracking)
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

MSSQL has two native change-capture mechanisms: Change Data Capture (CDC) and Change Tracking (CT). CDC captures full row data in system tables; CT only tracks which rows changed (no data).

## Decision

Use CDC as the primary mechanism. Fall back to Change Tracking only if CDC is unavailable (e.g. SQL Server Express, where CDC requires Enterprise or Developer).

CDC provides:

- Before-images (via "all update old" capture mode)
- Full row data
- LSN-based resume tokens
- Per-table capture instances

Polling interval: default 5 000ms (configurable). Polls `cdc.fn_cdc_get_all_changes_<capture_instance>()` from last processed LSN to current max LSN.

## Consequences

- CDC requires SQL Server Enterprise or Developer edition
- SQL Server Agent must be running (CDC uses Agent jobs for log reading)
- `EXEC sys.sp_cdc_enable_db` must be run once per database
- `EXEC sys.sp_cdc_enable_table` must be run once per tracked table
- Before-images available but require `'all update old'` capture mode — two rows per UPDATE (before + after)
- The adapter reads both rows and pairs them: `$__$operation = 3` (before) followed by `$__$operation = 4` (after)
- Polling latency is configurable; 5s default is acceptable for most real-time UI use cases
- CDC LSN history is retained for a configurable window (default 3 days); resume tokens older than the retention window will fail with an error

## Alternatives considered

- **Change Tracking**: Simpler, available on all editions, but no row data — only which rows changed. Insufficient for data-management real-time views.
- **SQL Server Service Broker**: Complex to configure; designed for message queuing not change capture; rejected
- **Triggers writing to a queue table**: Application-level CDC; adds write overhead on every DML; rejected for production-scale tables
