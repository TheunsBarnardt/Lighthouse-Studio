# Objective 4d: Change Streams Across All Three Databases

**Status:** Ready for development
**Prerequisites:** Objectives 4 (Postgres), 4a (MSSQL), 4b (Mongo), 4c (cross-database conformance) complete
**Blocks:** Real-time features in the data management module; live UI updates; webhooks; reactive subscriptions

---

## 1. Purpose

Implement `ChangeStreamPort` for all three databases. Provide a uniform `AsyncIterable<ChangeEvent>` interface that delivers reliable, ordered, resumable change events from each underlying database, with appropriate trade-offs documented per adapter.

This is the substrate for the killer feature: real-time table views and subscriptions in the data management module. Supabase has this on Postgres. Nobody has it as a packaged, polished feature on MSSQL. Few open-source platforms expose Mongo change streams ergonomically. The platform brings them all under one interface.

The implementation differs sharply across the three databases — different mechanisms, different operational requirements, different consistency guarantees — but the consumer-facing interface is identical. Service code subscribes to a port; the adapter does whatever its database needs.

This objective produces no user-visible features directly, but it produces the engine that the data management module uses to deliver them.

---

## 2. Scope

### In Scope

- `ChangeStreamPort` adapters for Postgres, MSSQL, and MongoDB
- Resume tokens / positions: subscribers can pick up where they left off
- Filtering at the source where supported, application-side where not
- Back-pressure handling: subscribers slower than the stream don't lose events nor crash the publisher
- Schema change handling: when the underlying schema changes, subscribers are notified appropriately
- Observability: dedicated metrics, tracing, structured logs for every change event flow
- Operational guidance per database: what must be enabled, what monitoring is required, what scales and what doesn't
- Backfill: when a subscriber starts fresh, it can optionally read existing data first then transition to live changes
- Capability declarations: each adapter honestly reports what it can and can't do
- Conformance test suite for change streams (added to the existing port conformance infrastructure)
- Cross-adapter equivalence tests: same change, three databases, three event streams that match

### Out of Scope (Belongs to Later Objectives)

- The data management module's real-time UI (separate objective)
- WebSocket transport from the platform's API to the browser (separate objective)
- Cross-database replication / sync features (not on the roadmap; explicitly not a goal)
- Schema migration coordination across change stream consumers (deferred — each consumer handles its own breaking changes)
- Event sourcing / event store as a primary persistence model (the platform uses change streams for notifications, not for state)

---

## 3. Locked Decisions

| Decision                            | Choice                                                                                           | Rationale                                                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Postgres mechanism                  | Logical replication via `pgoutput` plugin                                                        | Native; available in every Postgres 10+; supports filters; resumable                                              |
| MSSQL mechanism                     | Change Data Capture (CDC) tables, polled with backoff                                            | Native to SQL Server; standard approach; mature                                                                   |
| MSSQL fallback (if CDC unavailable) | Change Tracking + polling                                                                        | Less rich (no before-image), available on all editions, lower overhead                                            |
| Mongo mechanism                     | Native change streams via `watch()`                                                              | Native; designed for this; first-class                                                                            |
| Resume tokens (Postgres)            | LSN (log sequence number) string                                                                 | Postgres-native; survives restarts                                                                                |
| Resume tokens (MSSQL)               | LSN (binary, base64-encoded)                                                                     | MSSQL-native CDC LSN                                                                                              |
| Resume tokens (Mongo)               | Native resume token (BSON document, opaque)                                                      | Mongo-native                                                                                                      |
| Filtering (Postgres)                | Source-side via publication; column-level filters                                                | pg 15+ supports column lists in publications                                                                      |
| Filtering (MSSQL)                   | Application-side post-poll                                                                       | CDC doesn't filter at source                                                                                      |
| Filtering (Mongo)                   | Source-side via aggregation pipeline in watch()                                                  | Mongo-native                                                                                                      |
| Back-pressure                       | Bounded buffer per subscriber; oldest dropped if subscriber too slow; metric emits               | Better to drop than to crash; documented and dashboarded                                                          |
| Reliability guarantee               | At-least-once delivery; subscribers must be idempotent                                           | Stronger guarantees require more infrastructure than the value justifies                                          |
| Ordering guarantee                  | Per-key (per-row) ordering preserved; cross-key ordering not guaranteed                          | Standard CDC semantics; matches all three databases                                                               |
| Subscriber model                    | Each subscriber gets its own iterable; multiple subscribers per stream allowed                   | Standard fan-out pattern                                                                                          |
| Operational mode                    | "Pull" model: adapter opens the stream once, distributes to subscribers in-process               | One process = one stream connection; multi-instance = each instance its own stream (acceptable for at-least-once) |
| Schema evolution                    | Stream emits schema-change events when DDL hits a watched table; subscribers decide how to react | Surfacing the event is enough; coordination is the consumer's problem                                             |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     SERVICE LAYER (consumers)                          │
│                                                                        │
│  Real-time table viewer    Webhook dispatcher    Audit-log forwarder  │
│  (data management module)  (notifications)        (forensic logging)  │
│           │                       │                         │         │
└───────────┼───────────────────────┼─────────────────────────┼─────────┘
            │                       │                         │
            └───────────────────────┼─────────────────────────┘
                                    │
                                    ▼
                        ┌─────────────────────────┐
                        │   ChangeStreamPort      │
                        │   (consumer-facing API)  │
                        └────────────┬────────────┘
                                     │
                                     │ implemented by
                                     ▼
                        ┌─────────────────────────┐
                        │   In-process fan-out    │
                        │   - one source stream    │
                        │   - many subscribers     │
                        │   - bounded buffer each  │
                        │   - back-pressure metric │
                        └────────────┬────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
  │ changestream-     │  │ changestream-     │  │ changestream-     │
  │   postgres        │  │   mssql            │  │   mongo            │
  │                   │  │                    │  │                    │
  │ Logical repl.     │  │ Polls cdc.* tables│  │ db.collection.     │
  │ via pgoutput +    │  │ with checkpoint    │  │   watch()          │
  │ pg_logical_       │  │ in __platform_     │  │                    │
  │ slot_get_         │  │ stream_offsets     │  │                    │
  │ binary_changes    │  │                    │  │                    │
  └─────────┬─────────┘  └─────────┬──────────┘  └─────────┬─────────┘
            │                       │                       │
            ▼                       ▼                       ▼
   ┌────────────────┐      ┌────────────────┐    ┌────────────────┐
   │  PostgreSQL    │      │ SQL Server CDC │    │ Mongo replica  │
   │  (logical_     │      │  (cdc.<name>_  │    │   set oplog    │
   │  decoding)     │      │   CT tables)    │    │                │
   └────────────────┘      └────────────────┘    └────────────────┘
```

The fan-out layer is critical. The platform must NOT open one stream per subscriber — that would slam the database. It opens one stream per (database, table-set) tuple, and distributes events in-process to all subscribers.

---

## 5. The Hard Parts (Read This Before Coding)

These are the places where each database's CDC mechanism imposes real constraints that the abstraction must accommodate.

**5.1 Postgres logical replication setup**

Logical replication requires server-level configuration:

- `wal_level = logical` in `postgresql.conf`
- `max_replication_slots = 10` (or appropriate)
- `max_wal_senders = 10`
- A replication user with `REPLICATION` privilege
- Restart of Postgres for `wal_level` change to take effect

The platform's setup script and runbook handle this for self-hosted deployments. Customer-managed Postgres deployments (e.g., AWS RDS) need DBA action. The capability flag on the adapter goes from `change_streams: false` to `true` when these prereqs are met; the runtime check verifies on startup.

Logical replication slots are persistent — they accumulate WAL until consumed. **A slot whose consumer is gone but not deleted will fill the disk.** The platform monitors slot lag and alerts loudly.

**5.2 Postgres replication slots are connection-bound**

A logical replication slot is consumed by one connection at a time. The platform's adapter holds that connection from `directPool` (since PgBouncer transaction pooling won't work for a long-lived replication connection).

If the adapter process dies, the connection drops, but the slot persists with its accumulated WAL. The next process picks up where the previous left off. Resilient.

If the slot itself is deleted (operational error), all in-flight events are lost; subscribers must restart from the latest position. The runbook covers this scenario.

**5.3 MSSQL CDC requires a SQL Server Agent**

CDC depends on the SQL Server Agent service running. Capture and cleanup jobs are scheduled as Agent jobs. If Agent is disabled, CDC silently stops capturing changes.

This matters specifically for SQL Server **Express Edition**, which doesn't include Agent. Express deployments cannot use CDC. The fallback is **Change Tracking** (CT), which is lighter and doesn't require Agent — but provides only "what changed" not "what changed to what" (no before-image, no value detail without a re-read).

The platform's MSSQL adapter implements CDC by default and falls back to Change Tracking only if CDC isn't available, with capability flags reflecting the difference.

**5.4 MSSQL CDC retention is finite**

By default, CDC retains change data for 3 days (configurable). A subscriber offline longer than the retention window cannot resume from its old LSN; the runbook explains how to detect this and how to handle it (typically: re-snapshot the affected table).

The platform monitors the gap between the oldest subscriber's resume point and the CDC retention frontier. Alerts before subscribers fall off the window.

**5.5 MSSQL CDC has its own table per source**

CDC creates `cdc.<schema>_<table>_CT` tables that mirror source columns plus operation metadata. The platform polls these tables. Polling interval is configurable (default 1 second); shorter = lower latency, higher load.

**5.6 Mongo change streams require a replica set**

Already addressed in Objective 4b — the dev Compose stack initializes a single-node replica set so transactions and change streams work. Production deployments must be replica sets or sharded clusters; standalone Mongo is unsupported.

**5.7 Mongo change streams resume tokens have validity windows**

A resume token references the oplog. If the oplog has rolled past that point (oplog size exceeded), resume fails. The platform monitors oplog window vs. subscriber lag and alerts before tokens become invalid.

**5.8 Schema changes are surfaced differently**

- Postgres: `pgoutput` emits `RELATION` messages when a watched table's schema changes. The adapter parses these and emits a `SchemaChange` event on the stream.
- MSSQL: CDC tables don't auto-update on schema change. After a DDL, CDC must be re-enabled on the table; old CDC data may be unavailable. The runbook covers this. The adapter detects schema mismatches and emits an error event.
- Mongo: schema changes are mostly invisible (schemaless). When the platform's schema validator changes, that's tracked separately by the migration system; the change stream doesn't notify on this.

The `ChangeEvent` type includes a discriminant `kind: 'data' | 'schema_change'` so consumers can distinguish.

**5.9 Initial state vs. live changes**

A new subscriber typically wants to know the _current state_ of the watched table, then receive _changes from now on_. Three approaches:

- **Snapshot-then-stream** (Postgres, MSSQL, Mongo all support this): the adapter does a transactional read of the table at a known position, then opens the stream from that position. No events lost; no duplicates.
- **Stream-only**: subscriber gets only future changes; existing state is the consumer's problem.
- **Stream-and-replay**: stream from a backfill point, accepting some duplicates that the consumer must dedupe.

The port supports all three modes via subscriber options. Snapshot-then-stream is the default and works on all three databases.

**5.10 Filter pushdown vs. application-side**

- Postgres 15+: column lists in publications. Source-side filtering reduces volume.
- MSSQL CDC: no native filtering; application-side post-poll. Volume reduction has to happen in the adapter.
- Mongo: aggregation pipeline in `watch()` allows rich filtering at the source.

The Filter AST from Objective 1.5 is reused for change stream filters where supported. Where not, the application-side filter applies the same Filter AST to the change events post-fetch.

**5.11 Multi-instance deployment**

If two platform instances both subscribe to the same stream, each gets its own copy. That's at-least-once delivery (subscribers must be idempotent), and it's fine for in-process consumers (real-time UI updates) but wrong for cross-instance work (a webhook should fire once, not twice).

The platform's solution: in-process fan-out is the default. Cross-instance coordination uses a different abstraction — the `JobQueuePort` — where work is claimed by exactly one worker. Real-time UI uses change streams (per-instance subscribers). Webhooks and side-effects use the job queue.

This is documented and enforced by the data management module's design.

---

## 6. Component Specifications

### 6.1 ChangeStreamPort (revisited from Objective 1.5)

```typescript
// packages/ports/persistence/src/change-stream.port.ts

export interface ChangeStreamPort {
  /** Subscribe to changes on a specific table/collection. */
  watch(opts: WatchOptions): AsyncIterable<ChangeEvent>;

  /** Capability check. */
  supports(feature: ChangeStreamFeature): boolean;
}

export interface WatchOptions {
  schema?: string;
  table: string;

  /** Operations to emit. Defaults to all. */
  operations?: ChangeOperation[];

  /** Server-side filter (used where supported, application-side fallback). */
  filter?: Filter<unknown>;

  /** Resume from a previous position. Mutually exclusive with mode='snapshot_then_stream'. */
  resumeAfter?: string;

  /**
   * Initialization mode:
   * - 'stream': start from now, no backfill (default)
   * - 'snapshot_then_stream': read current state transactionally, then start streaming
   * - 'replay_from': replay from a specified time (best effort; may not be supported)
   */
  mode?: 'stream' | 'snapshot_then_stream' | 'replay_from';

  /** Used with mode='replay_from' */
  replayFrom?: Date;

  /** AbortSignal to cancel the subscription. */
  signal?: AbortSignal;
}

export type ChangeOperation = 'insert' | 'update' | 'delete' | 'truncate';

export type ChangeStreamFeature =
  | 'before_after_image' // events include both pre- and post-state
  | 'server_side_filter' // filter applied at the database layer, not after
  | 'replay_from_position' // can resume from a saved resume token
  | 'replay_from_time' // can replay from a specific timestamp
  | 'schema_change_events' // surfaces DDL events on watched tables
  | 'truncate_events'; // emits an event when the table is truncated

export type ChangeEvent =
  | { kind: 'data'; table: string; schema?: string; operation: ChangeOperation; before: Record<string, unknown> | null; after: Record<string, unknown> | null; occurredAt: Date; position: string }
  | { kind: 'snapshot_complete'; table: string; position: string }
  | { kind: 'schema_change'; table: string; description: string; occurredAt: Date }
  | { kind: 'gap'; reason: string; lastKnownPosition: string } // emitted if events were dropped
  | { kind: 'heartbeat'; position: string; emittedAt: Date }; // periodic, lets consumers checkpoint
```

The `gap` event is critical: when back-pressure causes events to be dropped, the consumer is told. They can decide to re-snapshot, log, or live with it.

The `heartbeat` event is critical for low-traffic streams: even if no rows change, the consumer can periodically save its position so a restart isn't a full re-snapshot.

### 6.2 In-Process Fan-Out

The fan-out layer sits between adapter sources and consumer subscriptions.

```typescript
// packages/adapters/changestream-shared/src/fanout.ts

export class ChangeStreamFanOut<T extends ChangeEvent = ChangeEvent> {
  private subscribers: Set<SubscriberHandle<T>> = new Set();
  private buffer: BoundedRing<T>;

  constructor(opts: FanOutOptions) {
    /* ... */
  }

  /** Add a subscriber. Returns an AsyncIterable. */
  subscribe(opts: SubscribeOptions): AsyncIterable<T> {
    /* ... */
  }

  /** Push a change event to all current subscribers. */
  push(event: T): void {
    /* ... */
  }

  /** Close all subscribers and stop the underlying source. */
  close(): Promise<void> {
    /* ... */
  }
}
```

Per-subscriber bounded buffer (default 1000 events). When a subscriber's buffer fills, the OLDEST event is dropped and a `gap` event is queued for delivery. The metric `platform_changestream_dropped_events_total{stream, subscriber}` increments.

### 6.3 Postgres Change Stream Adapter

**`packages/adapters/changestream-postgres/`**

Uses the `pg-logical-replication` library (or directly via `pg`'s replication protocol support). On startup:

1. Verify capability: query `pg_settings` for `wal_level`. If not `logical`, capability is `false` and the adapter declares accordingly.
2. Verify required extensions / publications. The platform creates a publication named `platform_publication` for tables it manages; customers subscribing to other tables get their own publications.
3. Create a logical replication slot named `platform_<env>` on first run. Subsequent restarts reuse it.
4. Start the replication stream using `START_REPLICATION SLOT <name> LOGICAL <lsn> ...`.
5. Decode `pgoutput` messages into `ChangeEvent` objects.

**Pgoutput message decoding:**

The library handles the binary protocol; the adapter translates messages:

- `INSERT` → `ChangeEvent { kind: 'data', operation: 'insert', after: {...}, before: null }`
- `UPDATE` → `ChangeEvent { kind: 'data', operation: 'update', after: {...}, before: {...} }` (before populated only if `REPLICA IDENTITY FULL` or `DEFAULT` with PK)
- `DELETE` → `ChangeEvent { kind: 'data', operation: 'delete', after: null, before: {...} }`
- `RELATION` → `ChangeEvent { kind: 'schema_change', description: '...' }`
- `TRUNCATE` → multiple `ChangeEvent { kind: 'data', operation: 'truncate' }` per affected table

**Operational concerns:**

- Replication slot lag monitored via `pg_replication_slots.confirmed_flush_lsn`
- Heartbeats every 10 seconds emit position
- On adapter shutdown: send `STANDBY STATUS UPDATE` with last consumed LSN before disconnecting (allows the slot to advance)

**Capability declaration:**

```typescript
supports(feature: ChangeStreamFeature): boolean {
  switch (feature) {
    case 'before_after_image': return this.replicaIdentity === 'FULL'; // tested per-table at runtime
    case 'server_side_filter': return this.pgVersion >= 15;
    case 'replay_from_position': return true;
    case 'replay_from_time': return false; // pg can't easily map time→LSN
    case 'schema_change_events': return true;
    case 'truncate_events': return true;
    default: return false;
  }
}
```

### 6.4 MSSQL Change Stream Adapter

**`packages/adapters/changestream-mssql/`**

Two sub-implementations:

**6.4a: CDC-based (preferred)**

On startup:

1. Verify CDC is enabled on the database: `SELECT is_cdc_enabled FROM sys.databases WHERE name = ?`
2. Verify SQL Server Agent is running: `SELECT status_desc FROM sys.dm_server_services WHERE servicename LIKE '%Agent%'`
3. For each watched table, verify CDC is enabled: `cdc.fn_cdc_is_capture_enabled_for_table(<table_id>)`
4. Read existing position from `__platform_stream_offsets` table or use current LSN if no position saved
5. Start polling loop

**Polling loop:**

```sql
-- Get changes since last known LSN, up to current
DECLARE @from_lsn binary(10) = ...;
DECLARE @to_lsn binary(10) = sys.fn_cdc_get_max_lsn();

SELECT * FROM cdc.fn_cdc_get_all_changes_<schema>_<table>(@from_lsn, @to_lsn, 'all update old');
```

For each row in the result:

- Decode `__$operation` (1=delete, 2=insert, 3=update before-image, 4=update after-image)
- For updates, the CDC function returns BOTH before and after rows; the adapter pairs them
- Translate to `ChangeEvent`
- Push to fan-out

After successful processing, save the new LSN to `__platform_stream_offsets`. This is the resumption checkpoint.

**Polling interval:** default 1 second; configurable via env var. Latency is at most the polling interval.

**6.4b: Change Tracking (fallback for non-Agent deployments)**

When CDC isn't available, Change Tracking provides a lighter alternative:

```sql
-- Get rows changed since version
SELECT t.*, ct.SYS_CHANGE_OPERATION, ct.SYS_CHANGE_VERSION
FROM CHANGETABLE(CHANGES <table>, @last_version) ct
LEFT JOIN <table> t ON t.<pk> = ct.<pk>;
```

Differences:

- No before-image (the adapter doesn't emit `before` for updates)
- No detailed value tracking (only "this row changed", a fresh read gives the current state)
- Capability `before_after_image: false`

The MSSQL adapter selects between these at startup based on availability and configuration.

**Capability declaration (CDC mode):**

```typescript
supports(feature: ChangeStreamFeature): boolean {
  switch (feature) {
    case 'before_after_image': return this.mode === 'cdc';
    case 'server_side_filter': return false; // CDC has no filter pushdown
    case 'replay_from_position': return true;
    case 'replay_from_time': return true; // sys.fn_cdc_map_time_to_lsn
    case 'schema_change_events': return false; // CDC requires re-enable on DDL; not real-time
    case 'truncate_events': return true; // CDC captures truncate as delete-all
    default: return false;
  }
}
```

### 6.5 Mongo Change Stream Adapter

**`packages/adapters/changestream-mongo/`**

The simplest of the three. Mongo has native change streams.

```typescript
const stream = collection.watch(pipeline, {
  fullDocument: 'updateLookup', // include the post-image
  fullDocumentBeforeChange: 'whenAvailable', // include the pre-image (Mongo 6+)
  resumeAfter: opts.resumeAfter, // if resuming
  startAtOperationTime: opts.replayFrom, // if time-based replay
});

for await (const change of stream) {
  // Translate Mongo change document to ChangeEvent
  yield translateMongoChange(change);
}
```

**Pre-image support:**

Requires `changeStreamPreAndPostImages: true` on the collection (Mongo 6+ feature; configured via `collMod` during initial setup of platform-managed collections). For collections without pre-image enabled, `before` is always null.

**Capability declaration:**

```typescript
supports(feature: ChangeStreamFeature): boolean {
  switch (feature) {
    case 'before_after_image': return this.preImagesEnabled;
    case 'server_side_filter': return true; // pipeline filtering
    case 'replay_from_position': return true;
    case 'replay_from_time': return true;
    case 'schema_change_events': return false; // schema is implicit
    case 'truncate_events': return false; // Mongo doesn't truncate
    default: return false;
  }
}
```

### 6.6 Conformance Tests for Change Streams

Added to `packages/ports/persistence/conformance/`:

- Subscribe and observe a change made via the repository: round-trip
- Multi-event sequence: insert, update, delete; subscriber sees all three in order
- Resume from position: subscribe, get events, save position, disconnect, reconnect with resumeAfter, get only new events
- Snapshot-then-stream mode: subscribe with snapshot mode; receive existing rows + snapshot_complete + new changes
- Filtering (where supported): subscribe with filter; only matching events delivered
- Operation filter: subscribe with `operations: ['insert']`; only insert events
- Multi-subscriber fan-out: two subscribers on the same stream both receive the same event
- Back-pressure: slow subscriber gets gap event; fast subscriber unaffected; metric increments
- Heartbeats on quiet streams
- Capability flag respect: subscribers don't request features the adapter doesn't support
- Cross-adapter equivalence (in 4c's cross-adapter suite): same change sequence on three databases, three event streams that match (modulo capability differences)

### 6.7 Observability

Specific metrics:

- `platform_changestream_events_total{adapter, table, operation}` — counter
- `platform_changestream_lag_seconds{adapter, stream}` — gauge of seconds between event time and delivery time
- `platform_changestream_buffer_used{adapter, stream, subscriber}` — gauge
- `platform_changestream_dropped_events_total{adapter, stream, subscriber}` — counter (back-pressure drops)
- `platform_changestream_subscriber_count{adapter, stream}` — gauge
- `platform_changestream_replication_slot_lag_bytes` (Postgres-specific) — gauge
- `platform_changestream_cdc_window_seconds` (MSSQL-specific) — gauge
- `platform_changestream_oplog_window_seconds` (Mongo-specific) — gauge
- `platform_changestream_resume_failures_total{adapter}` — counter

Each adapter emits its database-specific operational metric so the runbooks can target alerts properly.

**Alerts:**

- Postgres replication slot lag > 1 GB → page (slot is filling; consumer is gone or slow)
- MSSQL CDC window remaining < 6 hours → warn (subscribers must catch up)
- Mongo oplog window < 1 hour from oldest subscriber → warn
- Any subscriber drops > 100 events/minute → page
- Stream disconnect / reconnect rate > 5/minute → warn

### 6.8 Operational Runbooks

New files in `docs/runbooks/`:

- `changestream-postgres-setup.md` — wal_level, slots, publications; full step-by-step
- `changestream-postgres-orphaned-slot.md` — what to do when a slot is lagging or its consumer is gone
- `changestream-mssql-cdc-setup.md` — enabling CDC on database and tables; SQL Agent; cleanup jobs
- `changestream-mssql-cdc-window-exhaustion.md` — when subscribers fall outside the retention window
- `changestream-mssql-tracking-fallback.md` — using Change Tracking when CDC is unavailable
- `changestream-mongo-setup.md` — replica set; pre-image enablement; oplog sizing
- `changestream-mongo-resume-failure.md` — when resume tokens become invalid
- `changestream-debugging.md` — cross-adapter; how to diagnose "why isn't my subscriber getting events?"

### 6.9 Schema Migration Coordination Note

When a platform-managed table is altered (column added, type changed, etc.), in-flight change stream subscribers may receive events whose schema doesn't match what they expect. The adapter emits a `schema_change` event before the first post-DDL data event, giving subscribers a chance to react.

The data management module's real-time UI handles this by re-fetching the table definition and remounting. Webhook-style consumers either accept the new schema or reject events until they're updated.

This is the consumer's problem, not the adapter's. The adapter just surfaces the event.

---

## 7. Implementation Order

1. **Build the fan-out layer** in `packages/adapters/changestream-shared/`. Test it in isolation with a mock source. Verify back-pressure semantics with a mock slow subscriber.

2. **Implement the Mongo adapter** first (it's the simplest). Most of the work is translation; the underlying mechanism Just Works.

3. **Run conformance tests against Mongo** adapter. Establish the conformance baseline.

4. **Implement the Postgres adapter.** Logical replication setup (server config and slot management). Pgoutput decoding. Fan-out integration.

5. **Run conformance tests against Postgres.** Compare to Mongo's behavior; document any divergences (capability-flag-driven).

6. **Implement the MSSQL CDC adapter.** Polling loop, LSN management, before/after pairing.

7. **Implement the MSSQL Change Tracking fallback.** Lighter, but lossier.

8. **Run conformance tests against MSSQL.** Both modes. Document divergences.

9. **Add cross-adapter equivalence tests** to the cross-adapter suite from 4c. The same sequence of changes on three databases produces three streams that match for the operations and capabilities they share.

10. **Add change-stream-specific metrics** to the observability infrastructure.

11. **Add Grafana panels** for change stream operations (events/sec, lag, buffer use, drops).

12. **Configure alerts** for slot/window/oplog issues per adapter.

13. **Write all runbooks.**

14. **Write ADRs.**

15. **Run a chaos drill** — kill the adapter process while events are flowing; verify resume after restart works on all three.

16. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0047: At-Least-Once Delivery for Change Streams** — why; what it requires of consumers; the alternatives we rejected
- **ADR-0048: In-Process Fan-Out** — single source per (database, table); per-subscriber bounded buffer; back-pressure drops over crash
- **ADR-0049: Filter AST Reuse for Change Streams** — same Filter type, applied source-side or application-side per capability
- **ADR-0050: Heartbeat Events** — quiet streams still emit positions; consumers can checkpoint
- **ADR-0051: Schema Change Events** — surface, don't coordinate; consumers handle their own breaking changes

---

## 9. Verification Steps

1. **All three adapters pass the change stream conformance suite.**

2. **Cross-adapter equivalence holds.** Same sequence of changes, three databases, three event streams that match modulo declared capabilities.

3. **Resume works after disconnect.** Adapter process is killed mid-stream; restart picks up exactly where it left off; no duplicates beyond at-least-once tolerance; no gaps in operation log.

4. **Snapshot-then-stream works.** New subscriber receives existing rows, then snapshot_complete, then live changes. No row missing; no row duplicated except for legitimate at-least-once cases.

5. **Back-pressure works.** Artificially slow subscriber doesn't crash; receives gap event when buffer overflows; metric increments.

6. **Heartbeats on quiet stream.** Watch a table that has no changes for 5 minutes; verify heartbeats arrive periodically with current position.

7. **Multi-subscriber fan-out.** Two subscribers on the same stream both receive the same event. Adding a subscriber doesn't slow the others.

8. **Postgres replication slot is correctly created and tracked.** Verify slot exists in `pg_replication_slots`; verify consumed LSN advances as subscribers process events.

9. **Postgres replication slot lag alert fires.** Stop a subscriber; let WAL accumulate; verify alert.

10. **MSSQL CDC polling works.** Insert, update, delete a row; events appear within polling interval.

11. **MSSQL CDC window alert fires.** Configure a short retention; let a subscriber fall behind; alert fires before window exhaustion.

12. **MSSQL Change Tracking fallback works.** Disable CDC; verify the adapter falls back to CT; events still flow with appropriate capabilities reduced.

13. **Mongo change stream pre-images** present when enabled; absent (with capability flag false) when not.

14. **Mongo oplog window alert fires.** Reduce oplog size; let a subscriber lag; alert fires before tokens become invalid.

15. **Schema change event fires.** Add a column to a Postgres table; verify a `schema_change` event is emitted before subsequent data events.

16. **Filter pushdown works on Mongo and Postgres 15+.** Subscribers with filters receive only matching events; non-matching events never reach the adapter.

17. **Filter application-side works on MSSQL.** Subscribers with filters receive only matching events; non-matching events fetched then filtered out (verifiable via metrics: events_total > delivered_total).

18. **AbortSignal cancels subscriptions cleanly.** Subscribe with abort signal; abort; subscriber's iterator returns; no leaks.

19. **Observability flows.** Every change event produces a span (sampled), a metric, and a log line. Lag is dashboarded. Drops are alerted.

20. **Chaos drill.** Restart database; restart adapter; restart subscriber; in any order; system recovers and continues.

If all 20 pass, the objective is met.

---

## 10. Definition of Done

**Adapters**

- [ ] `changestream-postgres` adapter implemented and passing conformance
- [ ] `changestream-mssql` adapter (both CDC and CT modes) implemented and passing conformance
- [ ] `changestream-mongo` adapter implemented and passing conformance
- [ ] In-process fan-out layer with bounded buffers and back-pressure metrics
- [ ] All capability declarations honest and runtime-verified
- [ ] Heartbeats emitted on quiet streams

**Conformance**

- [ ] Conformance tests for ChangeStreamPort added to the suite
- [ ] All three adapters pass against the conformance suite
- [ ] Cross-adapter equivalence tests pass (3-way comparison for shared capabilities)

**Setup Infrastructure**

- [ ] Postgres deployment scripts enable wal_level=logical, create slots, create publications
- [ ] MSSQL deployment scripts enable CDC, create capture instances, configure SQL Agent
- [ ] Mongo deployment scripts enable change stream pre-images on platform-managed collections
- [ ] Capability checks at startup verify prerequisites; clear error if missing

**Observability**

- [ ] All change stream metrics emitted
- [ ] Grafana panels for change streams added to `platform-persistence.json`
- [ ] Alerts configured for slot lag, CDC window, oplog window, dropped events, resume failures

**Operational**

- [ ] All runbooks in Section 6.8 written
- [ ] Chaos drill executed and documented

**Documentation**

- [ ] ADRs 0047–0051 written and Accepted
- [ ] Capability matrix updated with change stream features
- [ ] Per-adapter README updated with change stream details

**Verification**

- [ ] All 20 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Opening one stream per subscriber.** Will hammer the database. The fan-out layer exists for this reason.
- **Silently dropping events without a `gap` event.** Consumers must know they missed something.
- **Pretending Postgres logical replication is "free."** It requires server config, monitoring, alerts, and operational vigilance. The runbook documents all of this.
- **Skipping the heartbeat events.** Quiet streams without heartbeats lead to subscribers that can never advance their position.
- **Letting the replication slot fill the disk.** Monitor and alert. Always.
- **Building cross-instance event coordination on top of change streams.** That's what the JobQueuePort is for.
- **Coupling consumers to specific change-event payload shapes per adapter.** The `before`/`after` field structure must be consistent across adapters; the mapper handles this. Consumers don't peek at adapter-specific fields.
- **Ignoring schema changes in subscribers.** A subscriber processing post-DDL events with a stale schema will produce subtle bugs. Surface and react.
- **Treating "at-least-once" as "we'll just dedupe in the consumer."** Consumers must be designed for idempotency from day one. This is in every consumer-facing contract.

---

## 12. Open Questions for Confirmation Before Starting

1. **Postgres logical replication user — separate from `platform_app` and `platform_migrate`?** Best practice says yes (a `platform_replication` user with REPLICATION privilege only). Confirmed?

2. **MSSQL CDC retention — 3 days default, configurable.** Recommendation: 7 days for production deployments to give wider catch-up window. Confirmed?

3. **Mongo oplog sizing.** Default for replica sets is 5% of disk; for production deployments running change streams, recommend at least 24 hours of retention regardless of disk size. Documented?

4. **Polling interval for MSSQL CDC.** Default 1 second. Latency vs. load tradeoff. Recommendation: 1 second default; configurable per stream; documented in tuning runbook.

5. **Buffer size per subscriber.** Default 1000 events. Memory cost ~ 1MB per subscriber for typical event size. Reasonable? Configurable per subscribe call.

6. **Heartbeat interval.** Default 10 seconds. Trade-off: shorter = faster checkpointing, slightly more network noise. Acceptable?

---

## 13. What Comes Next

With Objective 4d complete, the data layer of the platform is fully implemented across all three databases — including real-time change events. The data management module can now build a real-time table view feature that works on Postgres, MSSQL, and MongoDB with the same consumer API.

The persistence family (Objectives 4 through 4d) is genuinely complete. The platform's foundation for any data-touching feature is solid.

**Objective 5: Identity, Auth, and User Directory** is next. The platform's built-in auth (the Supabase-clone auth feature) is implemented as part of the data management module — making the platform's "auth" itself a feature of the data layer. This is the same architecture Supabase uses (GoTrue lives alongside Postgres-managed user data) but generalized: the platform's auth works on any of the three databases, with users and sessions stored in whichever database the customer chose.

The other identity adapters (Entra ID, OIDC, SAML) are alternative `IdentityProviderPort` implementations that don't require the platform to manage user records — they just verify identities. The User Directory always lives in the platform's chosen database.

After Objective 5, the platform has database, observability, and identity. The remaining foundation work (RBAC, audit, multi-tenancy enforcement, service layer) builds on this.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on._
