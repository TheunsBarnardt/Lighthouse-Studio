---
adr: 0046
title: MongoDB Change Streams — Native watch() with fullDocument Lookup
status: Accepted
date: 2026-05-02
deciders: Theuns Barnardt
---

## Context

MongoDB 3.6+ provides native change streams via `collection.watch()` or `db.watch()`. This is the most natural and well-supported mechanism.

## Decision

Use `db.watch()` (database-level watch) with an aggregation pipeline for source-side table filtering. Request `fullDocument: 'updateLookup'` to get the current document state after updates.

Resume tokens are MongoDB's native resume tokens (BSON documents serialized to JSON strings).

## Consequences

- Before-images NOT available by default — MongoDB requires `changeStreamPreAndPostImages: true` on the collection (MongoDB 6.0+) for pre-images. The capability flag `beforeImages: false` reflects this.
- Source-side filtering: watch pipeline filters by `ns.coll` so the server only sends events for watched collections
- After-images: `fullDocument: 'updateLookup'` does a post-update lookup — there is a small window where the document could be updated again between the change and the lookup. For the platform's real-time UI use case, this is acceptable.
- The adapter opens one `ChangeStream` cursor per process and distributes to all subscribers via `ChangeStreamFanout`
- Replica set required — change streams only work on replica sets and sharded clusters

## Alternatives considered

- **`collection.watch()` per collection**: Would require one cursor per watched collection; more connections, more overhead. The database-level watch with collection filter is more efficient.
- **Polling with timestamps**: Loses events between polls; no resume token; rejected
- **Oplog tailing**: Requires direct oplog access (mongodump user); more brittle than change streams; rejected
