import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';
import { createHmac, randomBytes } from 'node:crypto';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../../errors.js';

import { auditMeta, toAuditActor } from '../../context.js';
import {
  AuthenticationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../errors.js';
import { API_AUDIT_EVENTS } from './audit-events.js';

// ── Domain types ───────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  permissions: string[] | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyPrincipal {
  kind: 'api_key';
  keyId: string;
  workspaceId: string;
  permissions: string[] | null;
}

// ── Zod schemas ────────────────────────────────────────────────────────────────

const CreateApiKeyInputSchema = z.object({
  name: z.string().min(1).max(255),
  workspaceId: z.string().uuid(),
  expiresAt: z.coerce.date().optional(),
  permissions: z.array(z.string()).optional(),
});

// ── Key generation ─────────────────────────────────────────────────────────────

// HMAC secret: per-installation value loaded from environment / secret store.
// The service accepts it as a constructor dependency so tests can inject a known value.
const KEY_PREFIX_HEADER = 'pkey';
const PREFIX_LENGTH = 8;
const RANDOM_BYTES = 32; // 256 bits → 64 hex chars

function generateRawKey(): { rawKey: string; prefix: string } {
  const random = randomBytes(RANDOM_BYTES).toString('hex');
  const prefix = random.slice(0, PREFIX_LENGTH);
  const rawKey = `${KEY_PREFIX_HEADER}_${prefix}_${random.slice(PREFIX_LENGTH)}`;
  return { rawKey, prefix };
}

function hashKey(rawKey: string, hmacSecret: string): string {
  return createHmac('sha256', hmacSecret).update(rawKey).digest('hex');
}

// ── Service ────────────────────────────────────────────────────────────────────

export class ApiKeyService {
  constructor(
    private readonly repo: RepositoryPort<ApiKey>,
    private readonly authz: AuthorizationPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly hmacSecret: string,
  ) {}

  /**
   * Create a new API key for a workspace.
   * The plaintext key is returned exactly once; subsequent calls only return metadata.
   */
  async create(
    ctx: RequestContext,
    input: { name: string; workspaceId: string; expiresAt?: Date; permissions?: string[] },
  ): Promise<Result<{ key: ApiKey; plaintext: string }, AppError>> {
    // 1. Validate
    const parsed = CreateApiKeyInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid API key input',
          parsed.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        ),
      );
    }

    // 2. Authorize
    const authzResult = await this.authz.authorize(
      ctx,
      'api_key.create',
      `workspace:${input.workspaceId}`,
    );
    if (authzResult.isErr()) {
      return err(new ForbiddenError('Insufficient permission to create API keys'));
    }

    // 3. Generate key
    const { rawKey, prefix } = generateRawKey();
    const keyHash = hashKey(rawKey, this.hmacSecret);
    const now = new Date();

    const apiKey: ApiKey = {
      id: uuidv7(),
      workspaceId: input.workspaceId,
      name: input.name,
      keyPrefix: prefix,
      keyHash,
      permissions: input.permissions ?? null,
      expiresAt: input.expiresAt ?? null,
      lastUsedAt: null,
      revokedAt: null,
      createdByUserId: ctx.userId,
      createdAt: now,
      updatedAt: now,
    } as ApiKey & { keyHash: string };

    // 4. Persist
    const createResult = await this.repo.create(apiKey);
    if (createResult.isErr()) {
      return err(createResult.error as AppError);
    }

    // 5. Audit
    await this.audit.write({
      eventType: API_AUDIT_EVENTS.API_KEY_CREATED,
      actor: toAuditActor(ctx),
      workspaceId: input.workspaceId,
      resource: { type: 'api_key', id: apiKey.id },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { name: input.name, permissions: input.permissions ?? null },
      ...auditMeta(ctx),
    });

    this.logger.info('API key created', { keyId: apiKey.id, workspaceId: input.workspaceId });

    return ok({ key: createResult.value, plaintext: rawKey });
  }

  /** List all active (non-revoked) API keys for a workspace. */
  async list(ctx: RequestContext, workspaceId: string): Promise<Result<ApiKey[], AppError>> {
    // 1. Validate
    if (!workspaceId) {
      return err(new ValidationError('workspaceId is required'));
    }

    // 2. Authorize
    const authzResult = await this.authz.authorize(ctx, 'api_key.read', `workspace:${workspaceId}`);
    if (authzResult.isErr()) {
      return err(new ForbiddenError('Insufficient permission to list API keys'));
    }

    // 3. Execute
    const findResult = await this.repo.findMany({
      filter: {
        workspaceId: { _eq: workspaceId },
        revokedAt: { _is_null: true },
      } as never,
    });
    if (findResult.isErr()) return err(findResult.error as AppError);

    return ok(findResult.value.items);
  }

  /** Revoke an API key. Idempotent — revoking an already-revoked key is a no-op. */
  async revoke(ctx: RequestContext, keyId: string): Promise<Result<void, AppError>> {
    // 1. Validate
    if (!keyId) return err(new ValidationError('keyId is required'));

    // 2. Find
    const findResult = await this.repo.findById(keyId);
    if (findResult.isErr()) return err(findResult.error as AppError);
    if (!findResult.value) return err(new NotFoundError('ApiKey', keyId));

    const key = findResult.value;

    // 3. Authorize (must be member of the key's workspace)
    const authzResult = await this.authz.authorize(
      ctx,
      'api_key.revoke',
      `workspace:${key.workspaceId}`,
    );
    if (authzResult.isErr()) {
      return err(new ForbiddenError('Insufficient permission to revoke API keys'));
    }

    if (key.revokedAt) {
      return ok(undefined); // already revoked
    }

    // 4. Revoke
    const updateResult = await this.repo.update(keyId, {
      revokedAt: new Date(),
    } as Partial<ApiKey>);
    if (updateResult.isErr()) return err(updateResult.error as AppError);

    // 5. Audit
    await this.audit.write({
      eventType: API_AUDIT_EVENTS.API_KEY_REVOKED,
      actor: toAuditActor(ctx),
      workspaceId: key.workspaceId,
      resource: { type: 'api_key', id: keyId },
      action: 'revoked',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    this.logger.info('API key revoked', { keyId, workspaceId: key.workspaceId });

    return ok(undefined);
  }

  /**
   * Verify a raw API key string.
   * 1. Parse the prefix from the key.
   * 2. Compute HMAC of the full key.
   * 3. Look up by hash (unique; single row).
   * 4. Check revocation and expiry.
   * 5. Update last_used_at (fire-and-forget — don't block the request).
   */
  async verify(rawKey: string): Promise<Result<ApiKeyPrincipal, AppError>> {
    if (!rawKey.startsWith(`${KEY_PREFIX_HEADER}_`)) {
      return err(new AuthenticationError('Invalid API key format'));
    }

    const keyHash = hashKey(rawKey, this.hmacSecret);

    const findResult = await this.repo.findOne({ keyHash: keyHash } as never);
    if (findResult.isErr()) return err(findResult.error as AppError);
    if (!findResult.value) {
      return err(new AuthenticationError('Invalid API key'));
    }

    const key = findResult.value;

    if (key.revokedAt) {
      return err(new AuthenticationError('API key has been revoked'));
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      return err(new AuthenticationError('API key has expired'));
    }

    // Fire-and-forget last_used_at update — don't fail the request if this fails
    void (async () => {
      const r = await this.repo.update(key.id, { lastUsedAt: new Date() } as Partial<ApiKey>);
      if (r.isErr()) {
        this.logger.warn('Failed to update api_key last_used_at', { keyId: key.id });
      }
    })();

    return ok({
      kind: 'api_key',
      keyId: key.id,
      workspaceId: key.workspaceId,
      permissions: key.permissions,
    });
  }
}
