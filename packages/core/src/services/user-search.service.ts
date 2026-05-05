import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { PaginatedResult, User, UserDirectoryPort } from '@platform/ports-identity';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import { ForbiddenError, ValidationError } from '../errors.js';
import { observable } from '../observability/observable.js';

const UserSearchQuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  searchText: z.string().optional(),
  status: z.enum(['active', 'pending_verification', 'archived', 'all']).optional(),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(20),
});

export type UserSearchQuery = z.infer<typeof UserSearchQuerySchema>;

export class UserSearchService {
  readonly search!: (
    ctx: RequestContext,
    query: UserSearchQuery,
  ) => Promise<Result<PaginatedResult<User>, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly directory: UserDirectoryPort,
    private readonly audit: AuditPort,
    logger: LoggerPort,
  ) {
    const obs = { logger };
    this.search = observable('UserSearchService', 'search', obs, this._search.bind(this));
  }

  private async _search(
    ctx: RequestContext,
    query: UserSearchQuery,
  ): Promise<Result<PaginatedResult<User>, AppError>> {
    // 1. Validate
    const parsed = UserSearchQuerySchema.safeParse(query);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid search query',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize — workspace-scoped or installation-wide
    const action = parsed.data.workspaceId ? 'member.list' : 'installation.user.search';
    const authResult = await this.authz.authorize(ctx, action, 'user');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Execute
    const result = await this.directory.search({
      ...(parsed.data.searchText !== undefined ? { query: parsed.data.searchText } : {}),
      status: parsed.data.status ?? 'active',
      offset: parsed.data.offset,
      limit: parsed.data.limit,
    });
    if (result.isErr()) return err(new ForbiddenError(result.error.message));

    // 4. Audit (sampled — log to debug level only)
    if (parsed.data.workspaceId === undefined) {
      await this.audit.write({
        eventType: 'data_management.installation.user_searched',
        actor: toAuditActor(ctx),
        resource: { type: 'user', id: 'collection' },
        action: 'searched',
        outcome: 'success',
        correlationId: ctx.correlationId,
        metadata: { query: parsed.data.searchText ?? null },
        ...auditMeta(ctx),
      });
    }

    return ok(result.value);
  }
}
