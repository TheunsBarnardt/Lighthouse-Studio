import type { ChangeOperation } from '@platform/ports-eventing';

import type { CustomerTableDefinition } from '../schema-model.js';

// ── Transport ──────────────────────────────────────────────────────────────────

export type TransportKind = 'sse' | 'websocket';

// ── Close reasons ──────────────────────────────────────────────────────────────

export type CloseReason =
  | 'client_disconnect'
  | 'server_shutdown'
  | 'auth_revoked'
  | 'session_expired'
  | 'idle_timeout'
  | 'rate_limit_exceeded'
  | 'subscription_limit_exceeded';

// ── Deliverable event kinds ────────────────────────────────────────────────────

export type EventKind =
  | 'data'
  | 'snapshot_row'
  | 'snapshot_complete'
  | 'heartbeat'
  | 'gap'
  | 'schema_change'
  | 'error';

// ── The event shape delivered to subscribers ───────────────────────────────────

export interface DeliverableEvent {
  subscriptionId: string;
  kind: EventKind;
  operation?: ChangeOperation;
  table: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  position: string;
  occurredAt: string; // ISO 8601
  /** Column names whose values were redacted due to missing PII permission. */
  redacted?: string[];
  metadata?: Record<string, unknown>;
}

// ── Resume token ───────────────────────────────────────────────────────────────

export interface ResumeTokenPayload {
  connectionId: string;
  subscriptionId: string;
  lastDeliveredPosition: string;
  /** SHA-256 hash of the serialised filter, so resume can verify the filter didn't change. */
  filterHash: string;
  expiresAt: string; // ISO 8601
}

// ── Connection state ───────────────────────────────────────────────────────────

export interface ConnectionState {
  id: string;
  workspaceId: string;
  /** The user or service account driving this connection. */
  principalId: string;
  transport: TransportKind;
  createdAt: Date;
  lastHeartbeatAt: Date;
  /** ISO expiry of the session/token used at connect time. */
  sessionExpiresAt?: Date;
  subscriptions: Map<string, ActiveSubscription>;
}

// ── Subscription state ─────────────────────────────────────────────────────────

export interface SubscribeOptions {
  connectionId: string;
  subscriptionId: string;
  workspaceId: string;
  schemaId: string;
  tableId: string;
  tableDef: CustomerTableDefinition;
  filter?: unknown;
  fields?: string[];
  operations?: ChangeOperation[];
  mode: 'stream' | 'snapshot_then_stream';
  /** Caller-supplied row count used to enforce SNAPSHOT_MAX_ROWS before starting a snapshot. */
  rowCount?: number;
  resumeToken?: string;
}

export interface ActiveSubscription {
  id: string;
  connectionId: string;
  workspaceId: string;
  schemaId: string;
  tableId: string;
  tableDef: CustomerTableDefinition;
  filter?: unknown;
  fields?: string[];
  operations?: ChangeOperation[];
  mode: 'stream' | 'snapshot_then_stream';
  /** Ring buffer of events waiting for delivery. */
  buffer: DeliverableEvent[];
  lastDeliveredPosition?: string;
  totalDropped: number;
  createdAt: Date;
  /** Set on disconnect; cleared on reconnect or expiry. */
  resumeExpiry?: Date;
  /** Cancels the underlying change-stream consumer. */
  cancel: () => void;
}

// ── Subscription handle returned to callers ────────────────────────────────────

export interface SubscriptionHandle {
  subscriptionId: string;
  events: AsyncIterable<DeliverableEvent>;
  cancel: () => void;
}

// ── Internal revocation events ─────────────────────────────────────────────────

export type InternalRevocationEvent =
  | { kind: 'session.revoked'; sessionId: string; userId: string }
  | { kind: 'workspace.member_removed'; userId: string; workspaceId: string }
  | { kind: 'api_key.revoked'; keyId: string }
  | { kind: 'permission.changed'; userId: string; workspaceId: string }
  | { kind: 'schema.deployed'; schemaId: string };

// ── Platform-wide defaults ────────────────────────────────────────────────────

export const REALTIME_DEFAULTS = {
  MAX_SUBS_PER_CONNECTION: 50,
  MAX_CONNECTIONS_PER_PRINCIPAL: 10,
  MAX_CONNECTIONS_PER_WORKSPACE: 1000,
  /** Sustained event delivery limit per connection (token-bucket). */
  EVENTS_PER_SECOND: 100,
  /** Burst capacity (extra tokens; sustained for ≤5s). */
  EVENTS_BURST_CAPACITY: 1000,
  /** Events buffered per subscription before oldest is dropped. */
  BUFFER_SIZE: 1000,
  HEARTBEAT_INTERVAL_MS: 30_000,
  SSE_HEARTBEAT_INTERVAL_MS: 45_000,
  IDLE_TIMEOUT_MS: 60_000,
  RESUME_WINDOW_MS: 5 * 60 * 1_000,
  /** Tables exceeding this row count reject snapshot mode. */
  SNAPSHOT_MAX_ROWS: 100_000,
  /** Per-connection permission cache TTL. */
  PERMISSION_CACHE_TTL_MS: 30_000,
  /** How often long-lived connections revalidate the session token. */
  SESSION_REAUTH_INTERVAL_MS: 60_000,
} as const;
