---
adr: 0038
title: MSSQL Type Mapping — BIT, DATETIME2, UNIQUEIDENTIFIER, NVARCHAR(MAX)
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

MSSQL has a different type system from Postgres. The platform's normalized PlatformColumnType must map to MSSQL types consistently across all adapters.

## Decision

| Platform type            | MSSQL type                     | Notes                                    |
| ------------------------ | ------------------------------ | ---------------------------------------- |
| boolean                  | BIT                            | 0/1; mapper coerces to true/false        |
| string(n)                | NVARCHAR(n)                    | Unicode                                  |
| text                     | NVARCHAR(MAX)                  |                                          |
| integer                  | INT                            |                                          |
| bigint                   | BIGINT                         |                                          |
| decimal(p,s)             | DECIMAL(p,s)                   |                                          |
| date                     | DATE                           |                                          |
| timestamp / timestamp_tz | DATETIME2(7)                   | UTC; 100ns precision                     |
| uuid                     | UNIQUEIDENTIFIER               | Client-generated UUID v7                 |
| binary                   | VARBINARY(MAX)                 |                                          |
| json                     | NVARCHAR(MAX) + ISJSON() CHECK | No native JSON type in SQL Server < 2025 |
| array                    | **Not supported**              | DdlError thrown; capability flag false   |

## Consequences

- MSSQL adapter declares `array_columns: false`
- Schema DDL adapter rejects table definitions containing array columns
- Data management UI must hide array column option when targeting MSSQL
- JSON columns get an automatic `CHECK (ISJSON(col) = 1 OR col IS NULL)` constraint
- rowversion column (`_row_version`) provides optimistic locking at engine level

## Alternatives considered

- **DATETIMEOFFSET for timestamps**: More explicit timezone info, but DATETIME2 UTC is simpler and consistent with Postgres adapter's UTC-always convention
