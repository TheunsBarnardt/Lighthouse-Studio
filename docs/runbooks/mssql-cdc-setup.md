# Runbook: MSSQL Change Data Capture Setup

## Prerequisites

- SQL Server 2019+ Enterprise, Developer, or Standard (not Express)
- SQL Server Agent running
- `VIEW DATABASE STATE` permission for the CDC query user

## Enable CDC

### 1. Enable on the database

```sql
USE platform;
EXEC sys.sp_cdc_enable_db;
GO
```

### 2. Enable on each table

```sql
USE platform;
EXEC sys.sp_cdc_enable_table
  @source_schema = 'dbo',
  @source_name   = 'projects',        -- table name
  @role_name     = NULL,              -- NULL = no gating role
  @supports_net_changes = 0,          -- 0 = no net changes view (saves space)
  @captured_column_list = NULL;       -- NULL = all columns
GO
```

### 3. Verify CDC is working

```sql
SELECT * FROM sys.dm_cdc_log_scan_sessions ORDER BY start_time DESC;
-- Should show recent scan sessions

SELECT * FROM cdc.change_tables;
-- Should list enabled tables
```

## Monitor CDC Health

```sql
-- Check CDC capture lag (seconds since last scan)
SELECT DATEDIFF(SECOND, start_time, GETUTCDATE()) AS lag_seconds
FROM sys.dm_cdc_log_scan_sessions
WHERE session_id = (SELECT MAX(session_id) FROM sys.dm_cdc_log_scan_sessions);

-- Alert if lag > 30 seconds
```

## CDC Retention

CDC history is retained for a configurable window (default 3 days):

```sql
-- Check current retention
SELECT retention FROM cdc.change_tables LIMIT 1;

-- Adjust retention (in minutes; 4320 = 3 days)
EXEC sys.sp_cdc_change_job @job_type = 'cleanup', @retention = 4320;
```

## Troubleshooting

| Symptom                                | Cause                          | Fix                                          |
| -------------------------------------- | ------------------------------ | -------------------------------------------- |
| `Could not find function cdc.fn_cdc_*` | CDC not enabled                | `EXEC sys.sp_cdc_enable_db`                  |
| SQL Agent not running                  | Agent required                 | Start SQL Server Agent service               |
| Resume token too old                   | Event outside retention window | Increase retention or trigger a full re-sync |
| CDC scan not progressing               | Disk full / log backup issue   | Check SQL Server error log; free disk space  |

## Disable CDC (if needed)

```sql
-- Disable on a single table
EXEC sys.sp_cdc_disable_table @source_schema='dbo', @source_name='projects', @capture_instance='all';

-- Disable on the database
EXEC sys.sp_cdc_disable_db;
```
