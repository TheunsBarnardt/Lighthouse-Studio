import type { RepositoryPort } from '@platform/ports-persistence';

import { ok, err, type Result } from 'neverthrow';
import { createHash } from 'node:crypto';

import type { AppError } from '../errors.js';
import type { IdempotencyRecord } from './types.js';

import { InternalError } from '../errors.js';
import { DEFAULT_IDEMPOTENCY_WINDOW_MS } from './types.js';

type IdempotencyRepo = RepositoryPort<IdempotencyRecord>;

/**
 * Compute the hash used to deduplicate an idempotent operation.
 * Deterministic: same operation + key always produces the same hash.
 */
export function hashIdempotencyKey(operation: string, idempotencyKey: string): string {
  return createHash('sha256').update(`${operation}:${idempotencyKey}`).digest('hex');
}

/**
 * Execute a mutating operation with idempotency deduplication.
 *
 * When `idempotencyKey` is provided and a matching record exists within its
 * TTL window, the stored result is returned without re-executing `work`.
 * When `idempotencyKey` is absent, `work` runs unconditionally.
 *
 * Usage in a service method:
 *
 *   return withIdempotency(
 *     { repo, operation: 'WorkspaceService.create', workspaceId, idempotencyKey: ctx.idempotencyKey },
 *     async () => { ... return ok(result); }
 *   );
 *
 * The stored resultJson must be JSON-roundtrippable. Dates and Buffers are
 * preserved via JSON serialisation; if the result contains non-serialisable
 * types, serialize before storing.
 */
export async function withIdempotency<T>(
  opts: {
    repo: IdempotencyRepo;
    operation: string;
    workspaceId: string | null;
    idempotencyKey: string | undefined;
    windowMs?: number;
    id: () => string;
    now?: () => Date;
  },
  work: () => Promise<Result<T, AppError>>,
): Promise<Result<T, AppError>> {
  if (!opts.idempotencyKey) {
    return work();
  }

  const keyHash = hashIdempotencyKey(opts.operation, opts.idempotencyKey);
  const now = opts.now?.() ?? new Date();
  const windowMs = opts.windowMs ?? DEFAULT_IDEMPOTENCY_WINDOW_MS;

  // Check for existing record
  const existing = await opts.repo.findOne({
    _and: [{ keyHash: { _eq: keyHash } }, { operation: { _eq: opts.operation } }],
  } as Parameters<IdempotencyRepo['findOne']>[0]);

  if (existing.isOk() && existing.value) {
    const record = existing.value;
    if (record.expiresAt > now) {
      try {
        return ok(JSON.parse(record.resultJson) as T);
      } catch {
        // Corrupted record — fall through and re-execute
      }
    }
  }

  // Execute the operation
  const result = await work();

  if (result.isErr()) {
    // Do not cache failures — let the caller retry
    return result;
  }

  // Persist the result
  const expiresAt = new Date(now.getTime() + windowMs);
  const record: IdempotencyRecord = {
    id: opts.id(),
    version: 1,
    workspaceId: opts.workspaceId,
    operation: opts.operation,
    keyHash,
    resultJson: JSON.stringify(result.value),
    expiresAt,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: null,
    updatedBy: null,
  };

  const saveResult = await opts.repo.create(record);
  if (saveResult.isErr()) {
    // Duplicate insert race condition — re-read and return cached
    const raceResult = await opts.repo.findOne({
      _and: [{ keyHash: { _eq: keyHash } }, { operation: { _eq: opts.operation } }],
    } as Parameters<IdempotencyRepo['findOne']>[0]);

    if (raceResult.isOk() && raceResult.value) {
      try {
        return ok(JSON.parse(raceResult.value.resultJson) as T);
      } catch {
        return err(new InternalError('Failed to deserialize cached idempotency result'));
      }
    }
  }

  return result;
}
