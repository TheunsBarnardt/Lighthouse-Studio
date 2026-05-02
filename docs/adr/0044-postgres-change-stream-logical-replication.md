---
adr: 0044
title: Postgres Change Streams — Logical Replication via pgoutput
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

Postgres has multiple mechanisms for change notification: LISTEN/NOTIFY, logical replication, triggers, and polling. We need resumability, before-images, and column-level data.

## Decision

Use logical replication with the `pgoutput` plugin (built into Postgres 10+). This produces binary-encoded WAL messages that include full row data for INSERT, UPDATE (with old and new rows), and DELETE.

Implementation: Poll `pg_logical_slot_get_binary_changes()` on the direct connection (not PgBouncer, which doesn't support replication protocol). Parse pgoutput binary messages in the adapter.

Resume tokens are LSN strings (e.g. `0/1A2B3C4D`).

## Consequences

- `wal_level = logical` must be set in postgresql.conf
- Replication slot must be created before use
- The connecting user must have REPLICATION privilege
- A publication must exist (created by migrations): `CREATE PUBLICATION platform_pub FOR ALL TABLES`
- Before-images are available if REPLICA IDENTITY is set to FULL on tables (default is PRIMARY KEY only)
- The replication slot retains WAL until acknowledged — if the adapter stops consuming, WAL accumulates and disk fills up. The runbook covers monitoring and cleanup.
- Polling-based consumption (not streaming replication protocol) — simpler implementation, slightly higher latency than streaming, acceptable for the platform's use case

## Alternatives considered

- **LISTEN/NOTIFY**: No row data, no before-image, no resume — insufficient
- **pg_notify triggers**: Application-level; doesn't capture DDL changes; doesn't provide before-images efficiently
- **Streaming replication protocol**: More complex to implement (COPY BOTH mode); provides real-time push instead of polling; deferred to a future improvement
