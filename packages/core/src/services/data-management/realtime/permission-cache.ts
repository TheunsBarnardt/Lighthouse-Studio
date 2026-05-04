import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';

import { REALTIME_DEFAULTS } from './types.js';

// ── Permission cache ───────────────────────────────────────────────────────────

interface CacheEntry {
  result: boolean;
  expiresAt: number; // performance.now() epoch
}

/**
 * Per-connection permission cache with TTL.
 *
 * Reduces the cost of the per-event authz check (which would otherwise make a
 * round-trip to the authorization adapter on every single change event).
 *
 * TTL is 30 seconds by default (REALTIME_DEFAULTS.PERMISSION_CACHE_TTL_MS).
 * Cache is invalidated immediately when ConnectionManager receives a
 * permission.changed revocation event for this connection's user.
 *
 * Keyed as "<action>|<resourceType>|<resourceId?>" for maximum granularity.
 */
export class PermissionCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttl: number;

  constructor(
    private readonly authz: AuthorizationPort,
    ttlMs: number = REALTIME_DEFAULTS.PERMISSION_CACHE_TTL_MS,
  ) {
    this.ttl = ttlMs;
  }

  /** Check (with cache) whether ctx may perform action on resourceType. */
  async check(
    ctx: RequestContext,
    action: string,
    resourceType: string,
    resourceId?: string,
  ): Promise<boolean> {
    const key = `${action}|${resourceType}|${resourceId ?? ''}`;
    const now = performance.now();

    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const result = await this.authz.authorize(
      ctx,
      action,
      resourceType,
      resourceId !== undefined ? { resourceId } : undefined,
    );
    const allowed = result.isOk();

    this.cache.set(key, { result: allowed, expiresAt: now + this.ttl });
    return allowed;
  }

  /** Immediately evict all cached entries. Called on permission.changed events. */
  invalidate(): void {
    this.cache.clear();
  }
}
