# ADR-0185: Source Adapters per Type, Common Pipeline

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 25 — Stage 5: Data Migration

## Context

The platform supports 7 source types (Postgres, MSSQL, MySQL, MongoDB, CSV, JSON, Excel). Source-specific logic (connection, introspection, streaming) must be separated from the shared pipeline (transformation, validation, target writes).

## Decision

Each source type has its own adapter implementing a common `SourceAdapterPort`. The downstream migration pipeline (transformation engine, executor, validator) is source-agnostic and consumes the normalized `SourceDescription` and streamed `SourceRow` batches.

## Consequences

- Adding new source types requires only a new adapter, not changes to the pipeline.
- Source-specific bugs are isolated to their adapters and don't affect other sources.
- The common pipeline can be tested with any source type or a mock adapter.
- Source credentials never reach the pipeline layer; only the adapter handles them.

## Alternatives Considered

- **Monolithic migrator**: one class per source+target combination — rejected because it's O(sources × targets) complexity.
- **Generic connector (ODBC/JDBC)**: would limit platform to databases only, excluding files.
