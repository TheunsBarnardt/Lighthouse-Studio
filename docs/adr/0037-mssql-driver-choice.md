---
adr: 0037
title: MSSQL Driver — mssql (Tedious)
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

The platform needs a Node.js MSSQL driver that works cross-platform (Linux, Windows), has good TypeScript support, requires no native dependencies, and handles pooling natively.

## Decision

Use the `mssql` npm package (wraps Tedious under the hood).

## Consequences

- Pure JavaScript — works on Linux (CI, containers) and Windows (customer on-prem) without native compilation
- Built-in Tarn-based connection pool; no external pooler required (SQL Server connections are cheaper than Postgres)
- Named parameter binding (`@paramName`) instead of positional — different from Postgres adapter but safe from injection
- `enableArithAbort: true` set by default (required for some stored procedures and CDC queries)
- `OUTPUT INSERTED.*` used instead of `RETURNING *`
- `OFFSET … ROWS FETCH NEXT … ROWS ONLY` used instead of `LIMIT … OFFSET`

## Alternatives considered

- **node-mssql alternatives (sequelize-mssql, knex+tedious)**: Add ORM layer; Drizzle MSSQL support was not stable enough at implementation time
- **Prisma**: Too opinionated; doesn't fit the ports-and-adapters pattern
