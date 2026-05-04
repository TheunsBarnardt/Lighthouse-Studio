import type { InternalRevocationEvent } from './types.js';

// ── Interface ──────────────────────────────────────────────────────────────────

export type RevocationHandler = (event: InternalRevocationEvent) => void;

/**
 * In-process pub-sub for platform-internal revocation events.
 *
 * Separate from EventBusPort (the customer-facing pub-sub) and intentionally
 * simple: synchronous delivery, no persistence, handlers must not throw.
 *
 * Published by: MemberService.remove, SessionService.revoke, ApiKeyService.revoke,
 *               AuthorizationService.changePermission, SchemaService.deploy.
 * Subscribed by: ConnectionManager (closes connections on revocation).
 */
export interface InternalEventBus {
  publish(event: InternalRevocationEvent): void;
  subscribe(handler: RevocationHandler): () => void;
}

// ── Implementation ─────────────────────────────────────────────────────────────

export class InProcessEventBus implements InternalEventBus {
  private readonly handlers = new Set<RevocationHandler>();

  publish(event: InternalRevocationEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Handlers must not affect each other or the publisher.
      }
    }
  }

  /** Returns an unsubscribe function. */
  subscribe(handler: RevocationHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }
}
