import { createHash } from 'node:crypto';

import type { AuditEntryInput } from './types.js';

/** Sentinel hash used as prevHash for the very first event in a chain. */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * Compute the SHA-256 hash for an audit event.
 *
 * The canonical representation is a deterministic JSON string of a fixed set of
 * fields. Timestamps are epoch-milliseconds (integers) to avoid floating-point
 * round-trip precision issues across databases.
 *
 * The prevHash is included so the chain is cryptographically linked.
 */
export function computeAuditHash(
  entry: AuditEntryInput,
  sequence: number,
  occurredAtMs: number,
  prevHash: string,
): string {
  const canonical = JSON.stringify({
    eventType: entry.eventType,
    workspaceId: entry.workspaceId ?? null,
    actorKind: entry.actor.kind,
    actorId: entry.actor.id,
    resourceType: entry.resource.type,
    resourceId: entry.resource.id,
    action: entry.action,
    outcome: entry.outcome,
    correlationId: entry.correlationId,
    sequence,
    occurredAtMs,
    prevHash,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Recompute the hash for a persisted entry to verify chain integrity.
 * Fields must match exactly what was stored at write time.
 */
export function recomputeAuditHash(
  eventType: string,
  workspaceId: string | null,
  actorKind: string,
  actorId: string | null,
  resourceType: string,
  resourceId: string,
  action: string,
  outcome: string,
  correlationId: string,
  sequence: number,
  occurredAtMs: number,
  prevHash: string,
): string {
  const canonical = JSON.stringify({
    eventType,
    workspaceId,
    actorKind,
    actorId,
    resourceType,
    resourceId,
    action,
    outcome,
    correlationId,
    sequence,
    occurredAtMs,
    prevHash,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
