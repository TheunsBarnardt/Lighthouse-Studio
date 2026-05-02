/**
 * ChangeStreamPort — uniform interface for database change event streams.
 *
 * All three adapters (Postgres, MSSQL, MongoDB) implement this port.
 * Consumers receive an AsyncIterable<ChangeEvent> that never throws on normal
 * operation — errors are surfaced as ChangeEvent with kind='error'.
 *
 * At-least-once delivery: subscribers must be idempotent.
 * Per-key ordering is preserved; cross-key ordering is not guaranteed.
 */

// ── Event types ───────────────────────────────────────────────────────────────

export type ChangeEventKind = 'insert' | 'update' | 'delete' | 'schema_change' | 'gap' | 'error';

export interface BaseChangeEvent {
  /** Monotonically increasing within the stream, but NOT globally unique across restarts. */
  readonly sequenceNumber: bigint;
  /** Wall-clock time when the change was detected (not necessarily when it occurred). */
  readonly detectedAt: Date;
  /** Resume token — pass to ChangeStreamPort.subscribe() to restart from this point. */
  readonly resumeToken: string;
}

export interface InsertChangeEvent extends BaseChangeEvent {
  readonly kind: 'insert';
  readonly table: string;
  readonly rowId: string;
  /** Snapshot of the inserted row. May be null if the adapter cannot capture it. */
  readonly after: Record<string, unknown> | null;
}

export interface UpdateChangeEvent extends BaseChangeEvent {
  readonly kind: 'update';
  readonly table: string;
  readonly rowId: string;
  /** Row state before update. May be null if the adapter cannot capture it (e.g. CDC without before-image). */
  readonly before: Record<string, unknown> | null;
  /** Row state after update. */
  readonly after: Record<string, unknown>;
}

export interface DeleteChangeEvent extends BaseChangeEvent {
  readonly kind: 'delete';
  readonly table: string;
  readonly rowId: string;
  /** Row state before deletion. May be null. */
  readonly before: Record<string, unknown> | null;
}

export interface SchemaChangeEvent extends BaseChangeEvent {
  readonly kind: 'schema_change';
  readonly table: string;
  /** DDL statement or description of what changed. */
  readonly description: string;
}

/**
 * Gap event: the buffer overflowed and events were dropped.
 * Subscribers that receive this must re-sync from the source to avoid missing changes.
 */
export interface GapChangeEvent extends BaseChangeEvent {
  readonly kind: 'gap';
  readonly droppedCount: number;
}

export interface ErrorChangeEvent extends BaseChangeEvent {
  readonly kind: 'error';
  readonly error: Error;
  /** true if the stream has been terminated and no more events will be emitted. */
  readonly fatal: boolean;
}

export type ChangeEvent =
  | InsertChangeEvent
  | UpdateChangeEvent
  | DeleteChangeEvent
  | SchemaChangeEvent
  | GapChangeEvent
  | ErrorChangeEvent;

// ── Subscription options ──────────────────────────────────────────────────────

export interface SubscribeOptions {
  /**
   * Resume token from a previous subscription.
   * If provided, the stream resumes from after this point.
   * If omitted, starts from the current position (live tail only; no backfill).
   */
  resumeToken?: string;
  /**
   * If true, the stream first emits all existing rows as synthetic insert events,
   * then transitions to live changes. Useful for initial sync.
   */
  backfill?: boolean;
  /** Tables to watch. If omitted, watches all tables. */
  tables?: string[];
  /** Maximum number of events to buffer per subscriber before emitting gap events. */
  bufferSize?: number;
}

// ── Capability declaration ─────────────────────────────────────────────────────

export interface ChangeStreamCapabilities {
  /** Whether the adapter can capture before-images on updates. */
  beforeImages: boolean;
  /** Whether the adapter supports source-side filtering by table. */
  sourceFiltering: boolean;
  /** Whether the adapter supports resuming mid-stream without data loss. */
  resumable: boolean;
  /**
   * Operational prerequisites. Informational; not enforced at runtime.
   * E.g. "Logical replication must be enabled", "CDC must be enabled on tables".
   */
  prerequisites: string[];
}

// ── Port ──────────────────────────────────────────────────────────────────────

export interface ChangeStreamPort {
  /**
   * Start a change event subscription.
   * Returns an AsyncIterable that yields ChangeEvents until the subscription is cancelled.
   *
   * The caller cancels by breaking out of the for-await loop or calling .return() on the
   * iterator explicitly.
   *
   * Errors during streaming are surfaced as ErrorChangeEvent with fatal:true, after which
   * the iterable terminates naturally.
   */
  subscribe(opts?: SubscribeOptions): AsyncIterable<ChangeEvent>;

  /**
   * Declare the capabilities of this adapter honestly.
   * Used by the capability matrix and by the UI to show correct affordances.
   */
  capabilities(): ChangeStreamCapabilities;

  /**
   * Graceful shutdown: stop all internal resources (replication slot connections,
   * polling loops, etc.). Existing subscribers receive an ErrorChangeEvent with fatal:true
   * then their iterables terminate.
   */
  close(): Promise<void>;
}
