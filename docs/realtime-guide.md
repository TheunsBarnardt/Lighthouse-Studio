# Real-Time Subscriptions

The platform delivers live database changes to your clients as they happen. When a row is inserted, updated, or deleted, every connected subscriber sees the event within seconds — with the same filters, the same permissions, and the same PII redaction as your REST and GraphQL queries.

## Two Transports

Choose the transport that fits your stack:

| Transport                             | Endpoint                                     | Use case                                 |
| ------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| **GraphQL Subscriptions** (WebSocket) | `/api/v1/data/<workspace>/<schema>/graphql`  | GraphQL clients (Apollo, urql, etc.)     |
| **Server-Sent Events**                | `/api/v1/data/<workspace>/<schema>/realtime` | Simple HTTP clients, server-side workers |

Both deliver the same events with the same filtering and permission model. The official SDK (see Objective 19) picks the right transport automatically.

---

## GraphQL Subscriptions

### Subscribe to changes

```graphql
subscription {
  usersChanges {
    subscriptionId
    kind
    operation
    table
    after
    position
    occurredAt
    redacted
  }
}
```

### With a filter (only active users)

```graphql
subscription {
  usersChanges(operations: ["insert", "update"]) {
    operation
    after
    position
  }
}
```

### With snapshot mode

```graphql
subscription {
  usersChanges(snapshot: true) {
    kind
    operation
    after
  }
}
```

Snapshot mode delivers existing rows as `kind: "snapshot_row"` events, then a `kind: "snapshot_complete"` event, then live `kind: "data"` events.

### Resuming after disconnect

```graphql
subscription {
  usersChanges(resumeToken: "<token-from-previous-subscription>") {
    kind
    operation
    after
  }
}
```

Within 5 minutes of disconnect, pass the subscription ID as `resumeToken` to resume from where you left off.

---

## Server-Sent Events

### Connect and subscribe

```http
GET /api/v1/data/my-workspace/main/realtime?subscribe[users]=true
Authorization: Bearer <token>
```

### Multiple tables

```
GET /api/v1/data/my-workspace/main/realtime?subscribe[users]=true&subscribe[orders]=true
```

### With operation filter

```
GET /api/v1/data/my-workspace/main/realtime?subscribe[users][operations]=insert,update
```

### With snapshot mode

```
GET /api/v1/data/my-workspace/main/realtime?subscribe[users][mode]=snapshot_then_stream
```

### Response format

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: data
id: 01j1...
data: {"subscriptionId":"sub-1","kind":"data","operation":"insert","table":"users","after":{"id":"u-1","name":"Alice"},"position":"...","occurredAt":"..."}

event: heartbeat
id: 01j1...
data: {"position":"..."}
```

---

## Event Kinds

| Kind                | Description                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| `data`              | A live change event (insert, update, delete)                                         |
| `snapshot_row`      | An existing row delivered during snapshot mode                                       |
| `snapshot_complete` | Marks the end of snapshot; live events follow                                        |
| `heartbeat`         | Keepalive; carries the latest stream position                                        |
| `gap`               | Events were dropped because the buffer overflowed; `totalDropped` tells you how many |
| `schema_change`     | The table schema was updated; re-subscribe if your app caches the schema             |
| `error`             | Stream encountered an error; see `metadata.message`                                  |

---

## PII Redaction

Columns tagged as PII are automatically redacted in subscription events for subscribers without the matching `pii.read.<category>` permission — exactly the same as REST and GraphQL queries. The `redacted` field in the event lists the column names that were redacted.

```json
{
  "kind": "data",
  "operation": "insert",
  "after": { "id": "u-1", "name": "Alice", "email": null, "phone": null },
  "redacted": ["email", "phone"]
}
```

---

## Backpressure and Gaps

If your client can't keep up with the event rate, the platform buffers up to 1000 events per subscription. If the buffer fills, oldest events are dropped and a `gap` event is sent:

```json
{
  "kind": "gap",
  "totalDropped": 42,
  "position": "..."
}
```

When you receive a `gap`:

1. **Ignore** — if your app can tolerate missing events (activity feeds, live counters).
2. **Re-query** — fetch the current table state via REST and resume from the `gap` event's `position`.
3. **Re-subscribe with snapshot** — close the subscription and reconnect with `snapshot: true`.

---

## Connection Limits

| Limit                            | Default           |
| -------------------------------- | ----------------- |
| Connections per workspace        | 1000              |
| Connections per user             | 10                |
| Subscriptions per connection     | 50                |
| Events per second per connection | 100 (burst: 1000) |

When a limit is reached, new connections or subscriptions receive a `RATE_LIMIT` error with a clear message.

---

## Snapshot Mode Limitations

Snapshot mode reads existing rows then switches to live events. Very large tables (> 100,000 rows) are **not supported** in snapshot mode — the API returns `RESOURCE_TOO_LARGE` instead. For large tables:

1. Query the initial state via the paginated REST API (`/api/v1/data/<ws>/<schema>/<table>?limit=100&after=...`).
2. Note the `lastEventPosition` from the REST response headers.
3. Subscribe to live events from that position.

---

## Multi-Instance Deployments

Real-time subscription state is per-instance. For resume-after-disconnect to work reliably in multi-instance deployments, configure **sticky sessions** at your load balancer so clients reconnect to the same instance. See [realtime-multi-instance-sticky-sessions.md](runbooks/realtime-multi-instance-sticky-sessions.md).

Without sticky sessions, resume falls back to re-subscribe (the SDK handles this automatically; no data loss, one extra round-trip).

---

## Delivery Guarantee

Events are delivered **at-least-once**. Duplicates can occur after reconnect. Your client should be idempotent — applying the same row state twice should be safe. The standard pattern: use the row's primary key as an idempotency key; last-write-wins for UI updates.
