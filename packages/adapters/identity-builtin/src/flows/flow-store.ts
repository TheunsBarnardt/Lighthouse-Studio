/**
 * In-package storage interface for short-lived flow tokens.
 * In production this is backed by database tables; in tests by the
 * in-memory implementation below.
 *
 * All tokens are stored as HMAC-SHA256 hashes — the plaintext token
 * is only returned to the caller once and never stored.
 */
export interface FlowRecord {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: Date;
  consumedAt: Date | null;
  metadata: Record<string, unknown>;
}

export interface FlowStore {
  /** Store a new token record. */
  set(tokenHash: string, record: FlowRecord): Promise<void>;
  /** Look up by token hash. Returns null if not found. */
  get(tokenHash: string): Promise<FlowRecord | null>;
  /** Mark a token as consumed (idempotent). */
  consume(tokenHash: string): Promise<boolean>;
  /** Remove expired records. */
  cleanup(): Promise<void>;
}

/** In-memory FlowStore for testing and early development. */
export class InMemoryFlowStore implements FlowStore {
  private readonly records = new Map<string, FlowRecord>();

  set(tokenHash: string, record: FlowRecord): Promise<void> {
    this.records.set(tokenHash, record);
    return Promise.resolve();
  }

  get(tokenHash: string): Promise<FlowRecord | null> {
    const r = this.records.get(tokenHash);
    if (!r) return Promise.resolve(null);
    if (r.expiresAt <= new Date()) return Promise.resolve(null);
    if (r.consumedAt !== null) return Promise.resolve(null);
    return Promise.resolve(r);
  }

  consume(tokenHash: string): Promise<boolean> {
    const r = this.records.get(tokenHash);
    if (!r || r.consumedAt !== null) return Promise.resolve(false);
    this.records.set(tokenHash, { ...r, consumedAt: new Date() });
    return Promise.resolve(true);
  }

  cleanup(): Promise<void> {
    const now = new Date();
    for (const [k, r] of this.records.entries()) {
      if (r.expiresAt <= now) this.records.delete(k);
    }
    return Promise.resolve();
  }
}
