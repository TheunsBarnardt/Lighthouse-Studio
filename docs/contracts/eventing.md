# Contract: Eventing Ports

## Purpose

Provides two complementary eventing abstractions:

- **`EventBusPort`** — application-level publish/subscribe for domain events
  (workspace created, pipeline started, user invited). Messages are typed and
  routed by topic string. This is the primary inter-service communication
  mechanism within the platform.
- **`ChangeStreamPort`** — database-level row/document change notifications.
  Used for real-time data subscriptions (Data Browser live updates, audit
  capture, cache invalidation). Operates below the application layer; events
  carry raw before/after record images.

Both ports are defined in `@platform/ports-eventing`.

---

## Methods

### EventBusPort

#### publish<T>(topic: string, event: T, opts?: PublishOptions): Promise<Result<void, EventError>>

Publishes a typed event to a topic.

```typescript
interface PublishOptions {
  delay?: number; // Milliseconds to delay delivery (adapter-dependent)
  deduplicationKey?: string; // Idempotency key; duplicate publishes within TTL are dropped
}
```

**Pre-conditions:**

- `topic` must be a non-empty string. Convention: `domain.entity.action`
  (e.g., `workspace.member.invited`).
- `event` must be JSON-serializable. Adapters serialize to JSON; do not pass
  class instances with non-serializable state.
- `deduplicationKey`, if provided, must be stable for logically identical events.

**Post-conditions:**

- On `ok(void)`: the adapter has accepted the event. For the in-process adapter,
  handlers are invoked synchronously before resolution. For Redis and Postgres
  adapters, delivery is asynchronous.
- On `err(EventError)`: the event was not published.

---

#### subscribe<T>(topic: string, handler: EventHandler<T>, opts?: SubscribeOptions): Promise<Result<Subscription, EventError>>

Registers a handler for a topic.

```typescript
type EventHandler<T> = (event: T, context: EventContext) => Promise<Result<void, unknown>>;

interface EventContext {
  topic: string;
  eventId: string;
  publishedAt: Date;
}

interface SubscribeOptions {
  group?: string; // Consumer group name; enables competing-consumer delivery
  fromBeginning?: boolean; // Replay from oldest available event (adapter-dependent)
}

interface Subscription {
  unsubscribe(): Promise<void>;
}
```

**Pre-conditions:**

- `topic` must match the publishing side's convention.
- `group`, if provided, identifies a competing-consumer group. Only one member of
  the group receives each event. Omitting `group` delivers the event to every
  subscriber (fan-out).

**Post-conditions:**

- On `ok(Subscription)`: the handler is registered. The returned `Subscription`
  must be held and `unsubscribe()` called on teardown to prevent leaks.
- On `err(EventError)`: the handler was not registered.
- Handler return values are advisory; a handler returning `err(...)` does not
  re-deliver the event unless the adapter implements a retry policy.

---

### ChangeStreamPort

#### watch(opts): AsyncIterable<ChangeEvent>

Opens a change stream for a table or collection.

```typescript
interface WatchOptions {
  schema?: string; // Postgres schema or MSSQL schema name
  table: string; // Table name or collection name
  operations?: ChangeOperation[]; // Default: all operations
  filter?: Filter<unknown>; // Server-side row filter (capability-dependent)
}

type ChangeOperation = 'insert' | 'update' | 'delete' | 'truncate';

interface ChangeEvent {
  table: string;
  schema?: string;
  operation: ChangeOperation;
  before?: Record<string, unknown>; // Previous row state; capability-dependent
  after?: Record<string, unknown>; // New row state; null on delete
  occurredAt: Date;
  position: string; // Opaque cursor; use for replay
}
```

**Pre-conditions:**

- The adapter must be configured and the database must support change capture
  (see Capability Flags).
- The calling process must have permissions to read the change feed.
- For Postgres: logical replication must be enabled (`wal_level = logical`) and
  the replication slot must be created.

**Post-conditions:**

- Returns an `AsyncIterable` that yields `ChangeEvent` objects as changes occur.
- The iterable does not complete on its own; the caller must break the loop or
  destroy the stream.
- Backpressure is not modeled; slow consumers may cause the adapter to buffer.

---

#### supports(feature: ChangeStreamFeature): boolean

Queries whether the adapter supports an optional capability.

```typescript
type ChangeStreamFeature =
  | 'before_after_image' // ChangeEvent.before is populated on updates/deletes
  | 'server_side_filter' // WatchOptions.filter is evaluated in the database
  | 'replay_from_position'; // Stream can be re-opened from a saved position
```

**Pre-conditions:** None.

**Post-conditions:** Returns `true` only if the adapter reliably implements the
feature. Callers that need a feature should check and degrade gracefully if
unsupported.

---

## Error Codes

```typescript
type EventErrorCode =
  | 'PUBLISH_FAILED' // Adapter rejected the publish
  | 'SUBSCRIBE_FAILED' // Adapter rejected the subscription
  | 'UNKNOWN';
```

ChangeStreamPort errors are thrown as exceptions from the async iterator (there
is no `Result` wrapper on the iterable itself). Callers should wrap `for await`
loops in try/catch.

---

## Capability Flags

### EventBusPort — adapter comparison

| Adapter                 | `group` consumers | `delay` | `deduplicationKey` | `fromBeginning` |
| ----------------------- | ----------------- | ------- | ------------------ | --------------- |
| In-process EventEmitter | No (fan-out only) | No      | No                 | No              |
| Redis pub/sub           | No (fan-out only) | No      | No                 | No              |
| Postgres LISTEN/NOTIFY  | No (fan-out only) | No      | No                 | No              |

None of the current adapters implement competing-consumer delivery or delayed
delivery. `group` and `delay` options are accepted without error but ignored.

### ChangeStreamPort — adapter comparison

| Adapter                | `before_after_image`                      | `server_side_filter`  | `replay_from_position` |
| ---------------------- | ----------------------------------------- | --------------------- | ---------------------- |
| Postgres (wal2json)    | Yes (requires `REPLICA IDENTITY FULL`)    | No                    | Yes                    |
| MSSQL CDC              | No (after image only by default)          | No                    | Yes                    |
| MongoDB change streams | Yes (with `fullDocument: 'updateLookup'`) | Partial (match stage) | Yes                    |

---

## Performance Expectations

- `EventBusPort.publish` for the in-process adapter is synchronous and adds
  negligible overhead.
- Redis pub/sub publish latency is typically < 2 ms on co-located nodes.
- Postgres LISTEN/NOTIFY has no ordering guarantees and no persistence; missed
  events during connection loss are not replayed.
- `ChangeStreamPort` events should arrive within 100–500 ms of the originating
  write under typical load. Higher latency is acceptable; the stream is not a
  substitute for the write path.
- ChangeStreamPort is nullable in the container. If not registered, calling code
  must handle a null reference or use the NullChangeStreamAdapter that yields
  nothing and returns `false` for all `supports()` queries.

---

## Known Adapter Divergences

### Postgres LISTEN/NOTIFY

- Notification payload is limited to 8000 bytes. Large events are silently
  truncated. Use only for signaling (e.g., "something changed in table X"); do
  not embed full record content in the event payload.
- Messages are lost if no listener is connected at publish time. The platform
  uses LISTEN/NOTIFY for low-latency cache invalidation signals only, not for
  reliable delivery.

### MongoDB change streams

- `before` image is the document state immediately before the update, fetched
  via `fullDocument: 'updateLookup'`. On high-write tables, the fetched document
  may reflect a more recent state than the event's logical position.
- `filter` maps to a MongoDB aggregation `$match` stage. Only match-stage
  operators are supported; `$lookup` and `$group` are not.

### MSSQL CDC

- CDC must be enabled per-table (`sys.sp_cdc_enable_table`). Streams for
  unconfigured tables will not yield events.
- `before` image is not available by default. `supports('before_after_image')`
  returns `false` for MSSQL.

---

## Usage Examples

```typescript
// Publishing a domain event
const result = await eventBus.publish('workspace.member.invited', {
  workspaceId: ctx.workspaceId,
  invitedUserId: newMember.id,
  invitedBy: ctx.userId,
});
if (result.isErr()) {
  logger.warn('Event publish failed', { error: result.error });
  // Non-fatal; the operation already completed
}

// Subscribing to a topic
const subResult = await eventBus.subscribe<MemberInvitedEvent>('workspace.member.invited', async (event, context) => {
  await sendWelcomeEmail(event.invitedUserId);
  return ok(undefined);
});
if (subResult.isErr()) throw new Error('Failed to subscribe');
const sub = subResult.value;
// On shutdown:
await sub.unsubscribe();

// Watching a change stream
const stream = changeStream.watch({ table: 'records', operations: ['insert', 'update'] });
try {
  for await (const event of stream) {
    await handleChange(event);
  }
} catch (err) {
  logger.error('Change stream error', { err });
  // Reconnect logic lives above this layer
}
```

---

## Common Misuse

**Treating LISTEN/NOTIFY as a reliable queue.** Messages are dropped when no
listener is connected. Use Redis or an external queue for guaranteed delivery.

**Not calling `unsubscribe()`.** In-process subscriptions accumulate for the
lifetime of the process if not unsubscribed. This causes handler leaks and
duplicate event processing on restart in test environments.

**Assuming `before` is always populated.** Always check
`changeStream.supports('before_after_image')` before using `ChangeEvent.before`.
Code that dereferences `before` unconditionally will fail on MSSQL.

**Embedding large payloads in Postgres NOTIFY.** Stay under 7500 bytes. Publish
a record ID and let the subscriber fetch the full record.

**Relying on ChangeStreamPort when it is not registered.** The container
registers ChangeStreamPort as nullable. Code that resolves it must handle `null`
or use optional chaining. Do not assume it is always present.
