---
adr: 0042
title: MongoDB ID — UUID v7 as _id String (Not ObjectId)
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

MongoDB's default `_id` type is ObjectId (12-byte BSON). The platform uses UUID v7 (time-ordered UUIDs) as primary keys across all three databases for consistency.

## Decision

Store the platform UUID v7 string as MongoDB's `_id` field (BSON string type). Also store it as an `id` field in the document for cross-database query compatibility.

The `_id` uniqueness index is already provided by MongoDB. The adapter's `toDocument()` method sets both `_id` and `id` from the entity's `id` field.

## Consequences

- Primary key lookups use `{ _id: id }` for O(1) efficiency via the clustered `_id` index
- UUID v7 is time-ordered so `_id` index insertion is roughly sequential (no heavy fragmentation)
- UUID strings are larger than ObjectId (36 bytes vs 12 bytes) — acceptable tradeoff for cross-database consistency
- The `id` field duplication is a minor storage overhead (~36 bytes per document) — acceptable

## Alternatives considered

- **ObjectId for \_id + UUID v7 in id field**: Two separate indexes; ObjectId insertion order differs from platform ID order. Rejected for complexity.
- **UUID v7 as BSON Binary (subtype 4)**: More compact, but requires application-level binary ↔ string conversion at every boundary. String is simpler and sufficient.
