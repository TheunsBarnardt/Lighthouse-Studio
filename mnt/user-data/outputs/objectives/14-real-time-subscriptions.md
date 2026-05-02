# Objective 14: Real-Time Subscriptions

**Status:** Ready for development
**Prerequisites:** Objectives 4d (Change Streams), 12 (REST APIs), 13 (GraphQL APIs) complete
**Blocks:** Objective 18 (Data Browser uses live tables); Objective 19 (Public SDK exposes the subscription client)

---

## 1. Purpose

Expose the change streams from Objective 4d as a real-time subscription layer that customer applications can consume directly from the browser, mobile clients, or server-to-server processes. When a row changes in a customer table, every connected subscriber sees the change within seconds, with the appropriate permissions enforced and the same filtering grammar as the REST and GraphQL APIs.

This is the killer feature. Supabase's primary differentiator over plain Postgres is real-time. The platform delivers the same primitive on Postgres AND MSSQL AND MongoDB — three paradigm-different databases under one consistent client API.

The objective covers two delivery transports:
- **GraphQL Subscriptions** over WebSocket — the standard for GraphQL clients
- **Server-Sent Events (SSE) over HTTP** — for clients that prefer simpler transports, no WebSocket dependency

Both transports deliver the same change events; clients pick whichever fits their stack.

This is also the objective where the platform's authorization model meets the streaming paradigm. Permission decisions for a connected subscriber must be **continuously enforced**, not just checked once at connect time — a user whose access is revoked while connected must stop receiving events immediately.

---

## 2. Scope

### In Scope

- Two delivery transports: GraphQL subscriptions over WebSocket, and SSE over HTTP
- Per-table subscription endpoints with the same filter syntax as queries
- Permission enforcement at subscription start AND continuously (revocation propagates)
- Per-row permission filtering (events for rows the subscriber can't see are not delivered)
- PII redaction in delivered events (same rules as queries)
- Connection lifecycle: connect, authenticate, subscribe, deliver, unsubscribe, disconnect
- Backpressure handling: slow clients don't block the source stream
- Heartbeats: idle connections stay alive; dead connections detected and closed
- Resume tokens: clients can reconnect after disconnect and pick up where they left off (with bounded replay window)
- Snapshot-then-stream mode: new subscribers can optionally receive current state, then live updates
- Multiplexing: one WebSocket connection can carry many subscriptions
- Rate limiting: per-workspace and per-connection limits on subscription count and event rate
- Connection observability: per-connection metrics, traces, logs
- Cross-database conformance: same subscription API, same behavior on Postgres, MSSQL, Mongo
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Cross-table subscription joins (a query that watches multiple tables simultaneously) — the client subscribes to multiple tables independently and combines client-side
- Event aggregation (e.g., "notify me when count(active_users) drops below 10") — deferred; significantly more complex than per-row events
- Push notifications to mobile apps via APNs / FCM — separate concern; the platform delivers events to a server which can then push
- Persistent message queue semantics (replay from the beginning of time, exactly-once delivery) — at-least-once is the contract; the changes stream from Objective 4d enforces this
- The Realtime UI components in the Data Browser (Objective 18 will build on this)
- Customer-defined webhooks (event delivery to customer-supplied URLs) — separate objective

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| GraphQL subscription transport | `graphql-ws` protocol over WebSocket | Modern; replaces deprecated subscriptions-transport-ws; supported by graphql-yoga |
| SSE transport library | Native Node `Response` streaming via Fastify; no library needed | SSE is simple; no abstraction needed |
| Connection authentication | At connection initiation only; uses session token or API key | Re-auth on every event would crush performance |
| Permission re-check cadence | Every event for sensitive operations; cached per-connection for 30 seconds for normal reads | Balances correctness with cost |
| Revocation propagation | Workspace member removal triggers immediate connection drop for that user; broadcast via internal pub-sub | Sub-second propagation |
| Subscription ID format | Client-generated UUID per subscription; server validates uniqueness within connection | Standard pattern; client tracks its own subscriptions |
| Default subscription count limit per connection | 50 | Reasonable for typical apps; configurable per workspace |
| Default event rate limit per connection | 100 events/second | Bursty traffic absorbed by buffer; sustained limit prevents abuse |
| Buffer per subscription | 1000 events | If subscriber falls behind, oldest dropped with `gap` event |
| Heartbeat interval | 30 seconds | Standard; longer for SSE proxies (45s) configurable |
| Disconnect timeout | 60 seconds without heartbeat | Bounded; closer to standard load balancer timeout |
| Reconnect resume window | 5 minutes | After 5 minutes, server reclaims resources; client must re-snapshot |
| Snapshot mode | Optional per subscription; bounded by table size | Big tables: snapshot via paginated reads then live |
| Filter syntax | Same Filter AST as REST and GraphQL queries | Consistency |
| Event format | Same shape as ChangeEvent from Objective 4d, plus subscriber-relevant fields | Reuse; clients only need one mental model |
| Event delivery order | Per-row ordering preserved; cross-row ordering not guaranteed | Standard CDC semantics |
| Subscription endpoint paths | `/api/v1/data/<workspace>/<schema>/realtime` (SSE); GraphQL subscriptions over the existing `/graphql` endpoint upgraded to WS | Aligns with REST/GraphQL paths |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT                                        │
│                                                                       │
│  Browser SPA   Mobile App   Server-side Worker                       │
│      │             │              │                                  │
│      └─────────────┴──────────────┘                                  │
│                    │                                                  │
└────────────────────┼─────────────────────────────────────────────────┘
                     │
                     │ WebSocket (graphql-ws)  OR
                     │ HTTP SSE (text/event-stream)
                     ▼
        ┌──────────────────────────────┐
        │   Fastify HTTP / WS Server    │
        │   - TLS, compression           │
        │   - graphql-yoga handles WS   │
        │   - Native SSE handlers        │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Connection Manager           │
        │  - Tracks live connections     │
        │  - Per-connection state        │
        │  - Heartbeat scheduling        │
        │  - Revocation broadcasts       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Subscription Manager         │
        │  - Per-subscription state      │
        │  - Resume tokens               │
        │  - Backpressure buffers        │
        │  - Permission cache            │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Event Filter Pipeline        │
        │  - Apply subscription filter   │
        │  - Per-row permission check   │
        │  - PII redaction               │
        │  - Format for delivery         │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Source: ChangeStreamPort    │
        │   (one stream per workspace+  │
        │   table; in-process fan-out)  │
        │   - Postgres logical repl     │
        │   - MSSQL CDC                 │
        │   - Mongo change streams      │
        └──────────────────────────────┘
```

The pipeline starts with a small set of source streams (one per workspace+table) and fans out to many subscribers. The fan-out lives in process; each platform instance maintains its own. Cross-instance event coordination uses the JobQueuePort (already established in earlier objectives) when needed — but for real-time UI subscriptions, per-instance fan-out is correct (each browser session connects to one instance; that instance has the events the browser needs).

---

## 5. The Hard Parts

**5.1 Permission re-checking on a stream**

A subscriber connects, authorizes, and starts receiving events. Twenty minutes later, an admin removes them from the workspace. The subscriber must stop receiving events immediately.

Approach:

- **Connection-level revocation**: when a workspace member is removed, the platform publishes an internal event ("user X removed from workspace Y"). All connections matching this user+workspace are forcibly closed within 1 second.
- **Per-event permission check**: for each event before delivery, the subscription manager verifies the permission cache for the user. The cache TTL is 30 seconds, but the cache is invalidated immediately on workspace membership changes via the same internal event mechanism.
- **Per-row permission filter**: for fine-grained scenarios (a user who can read some rows but not others, e.g., row-level constraints based on ownership), the filter is applied to each event. Events whose row the subscriber can't see are silently dropped (no `gap` event because the subscriber isn't entitled to know they were filtered).

The performance impact is real: every event triggers a permission cache lookup. The cache is hash-table O(1); the impact is small.

**5.2 PII redaction in events**

The same redaction discipline as REST/GraphQL queries applies: events contain values for PII columns only if the subscriber has the matching `pii.read` permission for that PII category.

For a subscriber without `pii.read.contact` (the contact PII category covering email and phone), an event includes `email: null, phone: null` with a `redacted: ["email", "phone"]` field in the event meta.

This redaction happens in the event filter pipeline, after the source stream and before delivery. It's consistent with how queries work; clients see the same redaction model regardless of which API surface they use.

**5.3 Backpressure: slow subscribers vs. fast events**

A client that can't keep up with the event rate. Options:

- **Buffer with limit**: store up to N events; when full, drop oldest and emit a `gap` event so the client knows it missed something
- **Buffer unbounded**: never drop events but risk OOM
- **Disconnect**: if the client is too slow, kick them off

The platform chooses **buffer with limit + gap event**. Default 1000 events per subscription. If the subscriber falls more than 1000 events behind, the oldest are dropped and a `gap` event is queued. The client's options at that point: re-snapshot the table, accept the gap (some apps don't care), or reconnect with snapshot mode.

The metric `platform_realtime_dropped_events_total` increments per drop. Customers can dashboard this and alert if their app is regularly dropping events.

**5.4 Multiplexing on a single connection**

Browsers limit concurrent WebSocket connections per origin (typically 6). A complex SPA might want to subscribe to 20 tables. Without multiplexing, this either fails or requires multiple windows.

The graphql-ws protocol supports multiplexing natively: one WebSocket carries many GraphQL subscriptions, each with its own ID. The platform implements this correctly:
- Connection initialization message authenticates once
- Subscribe message starts a new subscription on the connection (carries its own ID)
- Server delivers events on the connection, tagged with the subscription ID
- Unsubscribe message cancels one subscription without closing the connection
- Connection close cleans up all subscriptions

For SSE, multiplexing is more awkward (SSE is unidirectional). The platform supports up to 50 subscriptions per SSE connection by URL parameters at connect time; adding/removing subscriptions during the connection requires a reconnect. This is documented as a limitation; clients who need dynamic subscription management use WebSocket.

**5.5 Resume after disconnect**

A client connected with subscription IDs A, B, C disconnects. They reconnect 30 seconds later. They want to resume A, B, C without losing events.

The platform supports this within a 5-minute window:
- On disconnect, the subscription state (filter, last delivered event position) is retained for 5 minutes
- On reconnect, the client passes the previous subscription IDs with `resumeFromPosition`
- The server looks up the saved state, fetches missed events from the change stream (using the saved position as a starting point), and resumes delivery
- After 5 minutes, the saved state is discarded; the client must re-subscribe (and optionally re-snapshot)

Implementation detail: subscription state is stored in memory of the platform instance the client originally connected to. If the platform is multi-instance and the client reconnects to a different instance, resume isn't possible (the new instance doesn't have the state). The client falls back to re-subscribe + re-snapshot. This is documented; for installations with multi-instance deployments, sticky sessions at the load balancer make resume work reliably.

For initial single-instance deployments (which is the common case for self-hosted), this isn't an issue.

**5.6 Snapshot-then-stream mode**

A new subscriber wants the current state of a table THEN live updates. Three approaches considered:

- **Snapshot-first**: query the table; deliver the current rows; then start the change stream from the position at query time. Risk: events that occur during the query window may be delivered as both snapshot rows AND change events, requiring the client to dedupe.
- **Subscribe-first-buffer**: open the change stream, buffer events, query the snapshot; deliver snapshot rows; then deliver buffered events. This works but the buffer can grow large during the snapshot.
- **Combined transactional read**: in databases that support it (Postgres logical replication exposes `START_REPLICATION` with a snapshot identifier), the snapshot and the stream start are atomically consistent.

The platform uses approach 3 where supported (Postgres native; Mongo via `startAfter` with a saved oplog position; MSSQL via CDC's snapshot LSN) and falls back to approach 2 for cases where atomic snapshot-then-stream isn't available.

The client receives:
1. Snapshot rows (each as an event with `kind: "snapshot_row"`)
2. A `kind: "snapshot_complete"` event (transition marker)
3. Live `kind: "data"` events from there

The bounded buffer limit applies during the snapshot phase too; very large tables (millions of rows) can't be snapshotted in this mode — the API rejects with a `RESOURCE_TOO_LARGE` error and recommends paginated initial query + live stream.

**5.7 Authentication on long-lived connections**

A WebSocket connection initiated with a session token can outlive the token (sessions expire; tokens get revoked). On a long-lived connection, the platform must:

- Track the session expiry
- Periodically (every minute) verify the session is still valid via SessionPort
- On session expiry or revocation, close the connection with a clear error code

For API key authentication, similar logic: API keys can be revoked while in use; revocation is broadcast via the internal event mechanism; matching connections close.

**5.8 Connection-level rate limiting and resource accounting**

Each connection consumes resources: memory for buffers, CPU for permission checks, file descriptors for the socket. Limits per workspace prevent any single workspace from monopolizing the platform's resources:

- Max concurrent connections per workspace: 1000 default, configurable
- Max concurrent connections per principal: 10 default
- Max subscriptions per connection: 50 default
- Max events per second per connection: 100 (bursty up to 1000 for 5 seconds)

Exceeding limits returns clear errors at subscribe time, not at connect time. A workspace at 1000 connections sees subsequent connects fail with a clear "limit exceeded" message; the platform doesn't silently drop connections.

**5.9 Heartbeats and idle detection**

WebSocket and SSE both support keepalive:

- WebSocket: native ping/pong frames; protocol-level
- SSE: comment lines (`: heartbeat\n\n`) sent every 30 seconds

Both transports detect dead connections within 60 seconds and close them. This matters because TCP connections can become "half-open" (the network path drops without TCP knowing), and without heartbeats, the platform would hold dead connection state forever.

The change stream layer from Objective 4d also emits heartbeat events when the upstream is quiet. These are delivered to subscribers as `kind: "heartbeat"` events with the latest position. Subscribers can checkpoint position even on quiet streams.

**5.10 Server-Sent Events fundamentals**

SSE is the simpler transport — pure HTTP, no WebSocket negotiation. Format:

```
GET /api/v1/data/acme/main/realtime?subscribe=users:filter[active][_eq]=true HTTP/1.1
Authorization: Bearer ...

HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: data
id: 1234567890
data: {"kind":"data","operation":"insert","after":{...},"position":"..."}

event: heartbeat
id: 1234567891
data: {"position":"..."}
```

SSE is one-way (server-to-client). For unsubscribe, the client closes the connection. For multiple subscriptions, the client sets up multiple SSE streams or uses the URL parameter format to declare multiple at connect time.

SSE works through most proxies and CORS configurations more easily than WebSocket; some customers prefer it for that reason.

**5.11 GraphQL subscriptions vs. REST-style realtime**

Both transports deliver the same data, but the API patterns differ:

GraphQL subscription:
```graphql
subscription {
  userChanges(filter: { active: { _eq: true } }) {
    operation
    before { id email active }
    after { id email active }
  }
}
```

REST SSE:
```
GET /api/v1/data/acme/main/realtime?
  subscribe[users][filter][active][_eq]=true&
  subscribe[users][fields]=id,email,active
```

For GraphQL clients (using Apollo Client, urql, etc.), the subscription pattern is the standard. For non-GraphQL clients (vanilla fetch, simpler stacks), SSE is more idiomatic.

The platform's SDK in Objective 19 wraps both, picking whichever the client prefers. Customer apps don't have to know which transport is in use.

---

## 6. Component Specifications

### 6.1 Connection Manager

```typescript
// packages/core/src/services/data-management/realtime/connection-manager.ts

export class ConnectionManager {
  constructor(
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
    private readonly authz: AuthorizationPort,
    private readonly sessions: SessionPort,
    private readonly internalEvents: InternalEventBus,
  ) {}

  /** Register a new connection. Returns a handle for managing it. */
  registerConnection(opts: ConnectionInit): Promise<Result<Connection, AppError>>;

  /** Close a connection cleanly with a reason. */
  closeConnection(connectionId: string, reason: CloseReason): Promise<void>;

  /** Force-close all connections for a user (e.g., on session revocation). */
  closeForUser(userId: string, reason: CloseReason): Promise<void>;

  /** Force-close all connections for a workspace member (e.g., on member removal). */
  closeForWorkspaceMember(userId: string, workspaceId: string, reason: CloseReason): Promise<void>;

  /** Get connection statistics. */
  stats(): ConnectionStats;
}

export interface Connection {
  id: string;
  workspaceId: string;
  userId: string | null;     // null if API-key-authenticated; principalId is filled instead
  principalId: string;        // user ID or service account ID
  transport: 'websocket' | 'sse';
  createdAt: Date;
  lastHeartbeatAt: Date;
  subscriptions: Map<string, Subscription>;
  // ... back-pointers and lifecycle hooks
}
```

Maintains the live connection registry. Listens to the internal event bus for revocation messages and forwards close requests.

### 6.2 Subscription Manager

```typescript
// packages/core/src/services/data-management/realtime/subscription-manager.ts

export class SubscriptionManager {
  constructor(
    private readonly schemas: SchemaService,
    private readonly authz: AuthorizationPort,
    private readonly changeStreams: ChangeStreamPort,
    private readonly filterParser: FilterParser,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
  ) {}

  /** Begin a subscription on a connection. */
  subscribe(opts: SubscribeOptions): Promise<Result<SubscriptionHandle, AppError>>;

  /** End a subscription. */
  unsubscribe(connectionId: string, subscriptionId: string): Promise<Result<void, AppError>>;

  /** Resume a previously-disconnected subscription. */
  resume(opts: ResumeOptions): Promise<Result<SubscriptionHandle, AppError>>;

  /** List active subscriptions on a connection. */
  listForConnection(connectionId: string): Subscription[];
}

export interface SubscribeOptions {
  ctx: RequestContext;
  connectionId: string;
  subscriptionId: string;
  workspaceId: string;
  schemaId: string;
  tableId: string;
  filter?: Filter<unknown>;
  fields?: string[];
  operations?: ChangeOperation[];
  mode: 'stream' | 'snapshot_then_stream';
}
```

Owns the per-subscription state: the change stream consumer, the buffer, the per-event filter pipeline, the resume position. One Subscription instance per active subscription.

### 6.3 Event Filter Pipeline

For each event from the change stream, before delivery to a subscriber:

```typescript
// packages/core/src/services/data-management/realtime/event-filter-pipeline.ts

export class EventFilterPipeline {
  /**
   * Process one event for one subscription.
   * Returns the filtered/redacted event to deliver, or null if it should be dropped.
   */
  async process(
    event: ChangeEvent,
    subscription: Subscription,
    permissionCache: PermissionCache,
  ): Promise<DeliverableEvent | null>;
}
```

Steps:
1. **Operation filter**: if subscription specifies `operations: ['insert']` and event is update, drop
2. **Filter AST**: if subscription has a filter, evaluate against the event's `after` (or `before` for deletes)
3. **Per-row permission**: check the subscriber has permission to read THIS row
4. **PII redaction**: redact PII fields the subscriber can't read
5. **Field projection**: keep only the fields the subscriber requested
6. Return the deliverable event; or null if dropped

Each step is independent and testable. The pipeline is the bridge between raw change events and what subscribers receive.

### 6.4 GraphQL Subscription Resolvers

The GraphQL schema generated in Objective 13 has placeholder Subscription fields. This objective fills them:

```typescript
// packages/core/src/services/data-management/graphql/subscription-resolvers.ts

export function buildSubscriptionResolvers(schema: CustomerSchema) {
  return {
    [`${tableName}Changes`]: {
      subscribe: async function* (parent, args, context) {
        // Create a subscription via SubscriptionManager
        const handle = await context.subscriptions.subscribe({
          ctx: context.ctx,
          connectionId: context.connectionId,
          subscriptionId: generateId(),
          workspaceId: context.workspace.id,
          schemaId: context.schema.id,
          tableId: tableId,
          filter: parseFilter(args.filter),
          fields: args.fields,
          operations: args.operations,
          mode: args.snapshot ? 'snapshot_then_stream' : 'stream',
        });
        if (handle.isErr()) throw new GraphQLError(/*...*/);
        
        // Yield events as they arrive
        for await (const event of handle.value.events) {
          yield { [`${tableName}Changes`]: event };
        }
      },
    },
  };
}
```

The async generator pattern is natively supported by graphql-yoga and the graphql-ws protocol.

### 6.5 SSE Endpoint Handler

```typescript
// packages/core/src/services/data-management/realtime/sse-handler.ts

export async function handleSseRequest(request: FastifyRequest, reply: FastifyReply) {
  // 1. Authenticate (same middleware as REST)
  // 2. Resolve workspace, schema
  // 3. Parse subscription params from URL
  // 4. Authorize
  // 5. Set SSE headers
  // 6. Register the connection in ConnectionManager
  // 7. Create subscriptions via SubscriptionManager
  // 8. Stream events to the response
  // 9. On client disconnect (request.raw.on('close')), unregister and clean up
}
```

The handler runs as a long-lived async function, holding the response open. Fastify supports this natively via the `reply.raw` low-level API.

### 6.6 Internal Event Bus

A small in-process pub-sub for cross-cutting events that need to reach the connection layer:

```typescript
// packages/core/src/internal/event-bus.ts

export interface InternalEventBus {
  publish(event: InternalEvent): void;
  subscribe(filter: EventFilter, handler: (event: InternalEvent) => void): Unsubscribe;
}

export type InternalEvent =
  | { kind: 'session.revoked'; sessionId: string; userId: string }
  | { kind: 'workspace.member_removed'; userId: string; workspaceId: string }
  | { kind: 'api_key.revoked'; keyId: string }
  | { kind: 'permission.changed'; userId: string; workspaceId: string }
  | { kind: 'schema.deployed'; schemaId: string };
```

Events publish from service layer code (e.g., MemberService.remove publishes `workspace.member_removed`); the ConnectionManager subscribes and acts on the relevant ones.

### 6.7 Authentication on Connection Initialization

WebSocket connection initialization (graphql-ws):

```typescript
// In the GraphQL server config
{
  graphqlEndpoint: '/api/v1/data/<workspace>/<schema>/graphql',
  context: async ({ extra, params }) => {
    // For WS: extra.connectionParams comes from client's first message
    const token = extra?.connectionParams?.authorization?.replace('Bearer ', '');
    const session = await sessions.findByToken(token);
    if (session.isErr() || !session.value) {
      throw new ConnectionInitError('Authentication failed');
    }
    return { ctx: buildRequestContext(session.value), connection: ... };
  },
};
```

For SSE: standard HTTP auth headers are used, identical to REST endpoint auth.

### 6.8 Resume Token Format

Resume tokens are opaque to clients. Internally:

```typescript
interface ResumeToken {
  connectionId: string;
  subscriptionId: string;
  lastDeliveredPosition: string;  // the change stream position
  filterHash: string;              // verifies the resume request matches the original filter
  expiresAt: Date;                  // 5 minutes from disconnect
}
```

Encoded as base64url JWT or similar. On resume, the server verifies the token, looks up the saved state, fetches missed events from the change stream from `lastDeliveredPosition`, and resumes.

### 6.9 Realtime-Specific Audit Events

```
data_management.realtime.connection_opened
data_management.realtime.connection_closed (with reason)
data_management.realtime.subscription_started
data_management.realtime.subscription_ended
data_management.realtime.subscription_resumed
data_management.realtime.connection_force_closed (revocation)
data_management.realtime.events_dropped (when buffer overflows)
data_management.realtime.rate_limit_exceeded
```

Connection open/close not audited individually for normal traffic (volume); aggregated metrics suffice. Forced closes ARE always audited because they have a security implication.

### 6.10 Observability

Realtime-specific metrics:

- `platform_realtime_active_connections{workspace, transport}` — gauge
- `platform_realtime_active_subscriptions{workspace}` — gauge
- `platform_realtime_events_delivered_total{workspace, table}` — counter
- `platform_realtime_events_dropped_total{workspace, table, reason}` — counter
- `platform_realtime_event_delivery_lag_seconds{workspace}` — histogram (event creation to delivery)
- `platform_realtime_buffer_used{workspace, subscription}` — gauge
- `platform_realtime_connection_duration_seconds{transport}` — histogram
- `platform_realtime_permission_check_duration_seconds` — histogram
- `platform_realtime_force_close_total{reason}` — counter

Slow event delivery (lag > 5 seconds) emits warnings; > 30 seconds emits errors. Sustained high drop rate emits warnings.

Trace spans: connection lifecycle is one span; each subscription is a child span; each event delivered is recorded as a span event (not a separate span — too high volume).

### 6.11 Rate Limiting

The realtime layer has its own rate limit scope distinct from API request limits:

- Subscriptions per connection: default 50, configurable
- Events delivered per second per connection: default 100 (1000 burst)
- Concurrent connections per principal: default 10
- Concurrent connections per workspace: default 1000

Limits are enforced via the same RateLimiterPort from Objective 12, with realtime-specific bucket keys.

### 6.12 Operational Runbooks

New files in `docs/runbooks/`:

- `realtime-connection-storm.md` — diagnosing and responding to mass-connection events
- `realtime-event-delivery-lag.md` — when events are arriving slowly; root cause investigation
- `realtime-buffer-overflows.md` — too many events being dropped; tuning buffers and rate limits
- `realtime-connection-limits.md` — adjusting per-workspace connection limits
- `realtime-revocation-not-working.md` — when a removed user is still receiving events
- `realtime-resume-failures.md` — clients reporting "can't resume" — diagnosing
- `realtime-multi-instance-sticky-sessions.md` — load balancer config for multi-instance deployments

---

## 7. Implementation Order

1. **Internal event bus** — small in-process pub-sub. Used by everything else.

2. **Connection manager** — connection registry, lifecycle, force-close on revocation. Test in isolation with mock connections.

3. **Subscription manager** — per-subscription state; reads from ChangeStreamPort; per-event filter pipeline.

4. **Event filter pipeline** — operation filter, AST filter, per-row permission, PII redaction, field projection. Each step independently tested.

5. **SSE handler** — Fastify route serving SSE. Manual subscription via URL params. End-to-end flow against the Postgres adapter first.

6. **GraphQL subscription resolvers** — fill the placeholders from Objective 13. graphql-ws over WebSocket. End-to-end flow.

7. **Authentication for WebSocket connections** — graphql-ws connection init + auth.

8. **Heartbeats** — both transports. Idle detection. Cleanup on dead connections.

9. **Backpressure** — bounded buffers, gap events, metrics.

10. **Snapshot-then-stream mode** — reuse change stream's snapshot capability.

11. **Resume after disconnect** — token format, state persistence, fetch-and-resume from change stream.

12. **Multiplexing** — multiple subscriptions per WebSocket; verified.

13. **Force-close on revocation** — wire internal event bus to ConnectionManager close calls.

14. **Rate limiting** — connection-level and event-level.

15. **Cross-database conformance tests** — same subscription, same data flow, same client experience on Postgres, MSSQL, Mongo.

16. **Performance tests** — 1000 concurrent connections, 100 events/sec each. Verify the platform sustains it.

17. **Audit events** integrated.

18. **Observability** — metrics, traces, logs, dashboards.

19. **Documentation** — runbooks, ADRs, customer-facing docs (especially the limitations on multi-instance and big-table snapshot).

20. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0112: Two Transports (WebSocket + SSE)** — why both; trade-offs; client guidance
- **ADR-0113: graphql-ws over Deprecated subscriptions-transport-ws** — modern, supported, secure
- **ADR-0114: At-Least-Once Delivery with Idempotent Consumer Contract** — what we promise; what we expect from clients
- **ADR-0115: Per-Event Permission Checks vs. Once-at-Connect** — security correctness over performance
- **ADR-0116: 5-Minute Resume Window** — bounded resource cost; clients reconnect or re-snapshot
- **ADR-0117: Bounded Buffers with Gap Events** — drop oldest with notification, don't OOM; clients informed
- **ADR-0118: In-Process Fan-Out, Sticky Sessions for Multi-Instance** — design constraint; documented limitation

---

## 9. Verification Steps

1. **SSE subscription works** end-to-end: connect, subscribe to a table, insert a row, see the event in the SSE stream.

2. **WebSocket subscription works** via graphql-ws: subscribe through GraphQL, receive events.

3. **Filter applied at source**: subscribe with a filter, only matching events delivered.

4. **Per-row permission filter**: a subscriber without access to certain rows doesn't see events for those rows.

5. **PII redaction**: a subscriber without `pii.read.contact` sees `email: null` in delivered events for tables with PII columns.

6. **Operation filter**: subscribing with `operations: ['insert']` delivers inserts but not updates/deletes.

7. **Snapshot-then-stream**: subscribe with snapshot mode; receive existing rows + snapshot_complete + live events; no row missed; bounded duplication.

8. **Backpressure**: simulate slow consumer; verify gap event fires when buffer overflows; metric increments.

9. **Heartbeats**: leave a subscription idle; receive heartbeat events at the configured interval.

10. **Multiplexing**: open one WebSocket; create 10 subscriptions; receive events for all; cancel one; others continue.

11. **Resume after disconnect**: disconnect; reconnect within 5 minutes with resume token; events from the disconnect period are delivered.

12. **Resume after window expiry**: disconnect; wait 6 minutes; reconnect; resume fails with appropriate error; client falls back to re-subscribe.

13. **Force-close on member removal**: subscribe; admin removes the user from the workspace; subscriber's connection closes within 1 second.

14. **Force-close on session revocation**: subscribe; revoke the session; connection closes promptly.

15. **Authentication on WS init**: connect with bad token; init message rejected with clear error.

16. **Rate limiting**: open 11 connections as same principal; 11th rejected with clear "limit exceeded" error.

17. **Subscription limit**: try to open 51 subscriptions on one connection; 51st rejected.

18. **Cross-database equivalence**: same subscription against Postgres, MSSQL, Mongo; same events delivered (modulo capability differences).

19. **Performance**: 1000 concurrent SSE connections, each subscribed to a busy table generating 10 events/sec; events delivered to 95% of subscribers within 2 seconds.

20. **Audit events**: subscription start, end, force-close all produce audit entries.

21. **Slow consumer**: a client that pauses; the platform absorbs up to 1000 events in buffer; emits gap; subsequent events flow.

22. **Schema change during active subscription**: deploy a schema change to a watched table; subscribers receive a `schema_change` event and can decide how to react.

23. **Event delivery lag**: under normal load, p95 lag (event creation time to delivery time) < 2 seconds.

24. **Reconnect performance**: client reconnects with resume token; resume completes in < 5 seconds even with a 5-minute event backlog.

25. **PII redaction is consistent across REST/GraphQL/realtime**: the same row queried via REST and observed via realtime shows the same PII redactions.

If all 25 pass, the objective is met.

---

## 10. Definition of Done

**Connection Layer**
- [ ] ConnectionManager implemented with registry, lifecycle, force-close
- [ ] Internal event bus implemented and integrated
- [ ] Heartbeats on both transports
- [ ] Idle detection and cleanup

**Subscription Layer**
- [ ] SubscriptionManager implemented
- [ ] Event filter pipeline (operation, AST, permission, PII, projection)
- [ ] Per-event permission checks with cache
- [ ] Backpressure with bounded buffers and gap events

**Transports**
- [ ] SSE handler in Fastify with URL-param subscription declaration
- [ ] graphql-ws over WebSocket integrated with graphql-yoga
- [ ] Multiplexing on WebSocket

**Modes**
- [ ] Stream-only mode
- [ ] Snapshot-then-stream mode (with size limits)
- [ ] Resume-after-disconnect within 5 minutes

**Authentication & Authorization**
- [ ] Connection-time auth (session + API key)
- [ ] Periodic re-auth on long connections
- [ ] Force-close on revocation events

**Limits**
- [ ] Subscriptions per connection
- [ ] Connections per principal and workspace
- [ ] Events per second per connection
- [ ] Buffer size per subscription

**Audit & Observability**
- [ ] Realtime-specific audit events
- [ ] Realtime-specific metrics
- [ ] Grafana dashboards for connections, subscriptions, lag, drops
- [ ] Alerts for high drop rate, high lag

**Cross-Database Conformance**
- [ ] Same subscription API on Postgres, MSSQL, Mongo
- [ ] Cross-database conformance tests pass
- [ ] PII redaction consistent across surfaces

**Performance**
- [ ] 1000 concurrent connections sustained
- [ ] 100 events/sec per connection sustained
- [ ] p95 delivery lag < 2 seconds under load

**Documentation**
- [ ] ADRs 0112–0118 written and Accepted
- [ ] All runbooks in Section 6.12 written
- [ ] Customer-facing realtime guide
- [ ] Multi-instance / sticky session documentation
- [ ] Big-table snapshot limitations documented

**Verification**
- [ ] All 25 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Authenticating once at connect, then trusting for the connection lifetime.** Sessions can expire; revocations happen. Periodic re-auth + revocation broadcasts are the discipline.
- **Sending the same event to all subscribers without filtering.** The filter pipeline runs per-subscription, per-event. Customers depend on it.
- **PII leakage in events when the subscriber lacks permission.** Redaction is mechanical and consistent with queries.
- **Letting buffers grow unbounded.** Memory explosion. Bounded buffers + gap events are the contract.
- **Skipping heartbeats "because the connection is fine."** Half-open TCP is real. Heartbeats catch it.
- **Storing subscription state outside the platform instance.** Cross-instance state is a separate problem; for now, sticky sessions handle it. Documenting the limitation is honest.
- **Implementing exactly-once delivery.** At-least-once is the contract. Clients dedupe via row identity. Easier to scale, easier to reason about.
- **Sending raw database events to subscribers.** The event filter pipeline is mandatory; raw events leak structure the subscriber shouldn't see.
- **Ignoring force-close events from revocation.** Failure mode: a removed user keeps receiving events. Security incident. Handle every revocation event.
- **Allowing very large snapshot mode without limits.** A million-row snapshot would take minutes and consume gigabytes. Documented size cap.
- **Treating realtime as "best effort, who cares about delivery guarantees."** Customers DO care. At-least-once + gap events + audit are the discipline.

---

## 12. Open Questions for Confirmation Before Starting

1. **Two transports vs. one** — proposing both WebSocket (graphql-ws) and SSE. WebSocket is more powerful; SSE is simpler. Recommendation: ship both; let customers pick. The marginal cost is low.

2. **Default limits** — 50 subs/connection, 100 events/sec/connection, 1000 connections/workspace. Sane defaults? Recommendation: start here, tune from production data.

3. **Resume window 5 minutes** — too short? too long? Recommendation: 5 minutes balances resource cost vs. client convenience. Configurable per workspace.

4. **Snapshot mode size limit** — propose: reject snapshot if table > 100,000 rows. Customer paginates instead. Acceptable?

5. **Multi-instance support** — proposing sticky sessions for resume to work; without sticky sessions, resume falls back to re-snapshot. Acceptable as initial design? Cross-instance state replication is a future objective if customers demand it.

6. **At-least-once vs. exactly-once** — at-least-once is the lock-in. Exactly-once requires distributed coordination that's not worth the complexity. Confirmed clients can dedupe via row identity?

7. **GraphQL subscriptions over WebSocket only** — proposing. GraphQL-over-SSE exists but is rare and adds complexity. Recommendation: WebSocket for GraphQL subscriptions; SSE for the REST-style realtime endpoint.

---

## 13. What Comes Next

With Objective 14 complete, the **data plane is fully real-time** across all three databases. Customers building applications on the platform can subscribe to changes the same way they query for data, with the same filters, the same permissions, the same PII redaction. The Supabase comparison stops being aspirational — it's actual feature parity, and the platform offers it on databases Supabase doesn't.

The data plane (REST + GraphQL + Realtime) is now a complete API surface. What remains is **the user-facing surfaces** — the screens that turn the platform from "a backend" into "a backend with a beautiful admin interface customers can show their teams":

**Objective 15: Storage Browser & File Management** — UI on top of `ObjectStoragePort`. Upload, organize, share files with the same RBAC as everything else.

**Objective 16: Auth & User Management UI** — the customer-facing screens for the auth system from Objective 5. Sign-in, sign-up, MFA enrollment, account settings, admin-side user management.

**Objective 17: Query Console** — SQL/Mongo console with safety rails (read-only by default, query timeouts, result size limits). For customers' developers who want direct database access.

**Objective 18: Data Browser & Editor** — table viewer, row editor, CSV import/export, real-time updates baked in (using Objective 14). The screen most customers will spend the most time in.

**Objective 19: Public SDK** — wraps everything (REST, GraphQL, Realtime, Storage, Auth) into a TypeScript / Python / etc. SDK. The "Supabase client equivalent" customers' developers use to build their applications.

After Objective 19, the Data Management Module is a complete, sellable product. A customer can install the platform, point it at their database, and have an entire Supabase-equivalent stack — on Postgres, MSSQL, or MongoDB.

---

*This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 15.*
