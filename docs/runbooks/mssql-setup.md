# Runbook: MSSQL Setup for Platform

## Prerequisites

- SQL Server 2019 or 2022 (Express edition not supported for CDC; Developer or Enterprise required)
- SQL Server Agent running
- Network access from platform application servers to SQL Server port 1433

## Initial Setup

### 1. Create database

```sql
CREATE DATABASE platform;
ALTER DATABASE platform SET READ_COMMITTED_SNAPSHOT ON;
GO
```

`READ_COMMITTED_SNAPSHOT` enables non-blocking reads (MVCC-like behavior, matches Postgres semantics).

### 2. Create application and migration users

```sql
-- Application user (DML only)
CREATE LOGIN platform_app WITH PASSWORD = '<strong-password>';
CREATE USER platform_app FOR LOGIN platform_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO platform_app;

-- Migration user (DDL)
CREATE LOGIN platform_migrate WITH PASSWORD = '<strong-password>';
CREATE USER platform_migrate FOR LOGIN platform_migrate;
ALTER ROLE db_ddladmin ADD MEMBER platform_migrate;
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, CREATE INDEX ON SCHEMA::dbo TO platform_migrate;
```

### 3. Enable CDC (if using change streams)

```sql
USE platform;
EXEC sys.sp_cdc_enable_db;
GO

-- Enable on each tracked table (example):
EXEC sys.sp_cdc_enable_table
  @source_schema = 'dbo',
  @source_name = 'projects',
  @role_name = NULL,
  @supports_net_changes = 0;
GO
```

### 4. Run migrations

```bash
MSSQL_SERVER=<host> MSSQL_DATABASE=platform MSSQL_USER=platform_migrate \
MSSQL_PASSWORD=<password> MSSQL_TRUST_SERVER_CERTIFICATE=false \
pnpm --filter @platform/adapter-persistence-mssql db:migrate apply
```

## Health Checks

```sql
-- Connection health
SELECT 1 AS ok;

-- CDC status
SELECT * FROM sys.dm_cdc_log_scan_sessions ORDER BY start_time DESC;

-- Replication slot equivalent (CDC cleanup)
SELECT * FROM cdc.change_tables;
```

## Troubleshooting

| Symptom                      | Cause                       | Fix                                             |
| ---------------------------- | --------------------------- | ----------------------------------------------- |
| CDC queries fail             | CDC not enabled on database | `EXEC sys.sp_cdc_enable_db`                     |
| SQL Server Agent not running | Agent required for CDC      | Start Agent service                             |
| Deadlock errors              | High concurrent write load  | Review `_version` column indexes; enable RCSI   |
| Timeout on large tables      | Missing indexes             | Add index on `[_archived_at]` and query columns |

## Backup and Restore

```bash
# SQL Server backup via sqlcmd
sqlcmd -S <server> -U <user> -P <password> -C \
  -Q "BACKUP DATABASE [platform] TO DISK = '/backup/platform.bak' WITH STATS=10"

# Restore
sqlcmd -S <server> -U <user> -P <password> -C \
  -Q "RESTORE DATABASE [platform] FROM DISK = '/backup/platform.bak' WITH REPLACE"
```
