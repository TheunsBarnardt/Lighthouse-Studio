import type { RequestContext } from '@platform/ports-authorization';
import type {
  Filter,
  Page,
  PaginatedResult,
  RepositoryPort,
  Sort,
  ConflictError,
} from '@platform/ports-persistence';

import { EntityNotFoundError, PersistenceError } from '@platform/ports-persistence';
import { err, type Result } from 'neverthrow';

// ── Sentinel repo that rejects every operation ─────────────────────────────────

function rejectAllRepo<TEntity extends { id: string }>(reason: string): RepositoryPort<TEntity> {
  const reject = (): never => {
    throw new PersistenceError('UNKNOWN', reason);
  };
  return {
    findById: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    findOne: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    findMany: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    count: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    create: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    update: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    archive: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    hardDelete: () => Promise.resolve(err(new PersistenceError('UNKNOWN', reason))),
    // Unreachable — TypeScript requires the return type; reject() satisfies it.
    _reject: reject,
  } as unknown as RepositoryPort<TEntity>;
}

// ── Workspace-filter wrapper ───────────────────────────────────────────────────

type WorkspaceScopedEntity = { id: string; workspaceId: string };

/**
 * Wraps a repository so every query automatically includes
 * `workspace_id = ctx.workspaceId` in the filter.
 *
 * If the context carries no workspaceId, every call returns a PersistenceError.
 * This makes workspace-scope forgetting a runtime error rather than a silent data leak.
 */
export function bindToContext<TEntity extends WorkspaceScopedEntity>(
  repo: RepositoryPort<TEntity>,
  ctx: RequestContext,
): RepositoryPort<TEntity> {
  if (!ctx.workspaceId) {
    return rejectAllRepo<TEntity>(
      'workspace_id is required in RequestContext for workspace-scoped operations',
    );
  }

  const wsId = ctx.workspaceId;
  const wsFilter: Filter<TEntity> = { workspaceId: { _eq: wsId } } as Filter<TEntity>;

  function mergeFilter(userFilter?: Filter<TEntity>): Filter<TEntity> {
    if (!userFilter) return wsFilter;
    return { _and: [wsFilter, userFilter] };
  }

  return {
    findById(id: string): Promise<Result<TEntity | null, PersistenceError>> {
      return repo.findOne(mergeFilter({ id: { _eq: id } } as Filter<TEntity>));
    },

    findOne(filter: Filter<TEntity>): Promise<Result<TEntity | null, PersistenceError>> {
      return repo.findOne(mergeFilter(filter));
    },

    findMany(opts?: {
      filter?: Filter<TEntity>;
      sort?: Sort<TEntity>;
      page?: Page;
      includeArchived?: boolean;
    }): Promise<Result<PaginatedResult<TEntity>, PersistenceError>> {
      return repo.findMany({ ...opts, filter: mergeFilter(opts?.filter) });
    },

    count(filter?: Filter<TEntity>): Promise<Result<number, PersistenceError>> {
      return repo.count(mergeFilter(filter));
    },

    create(entity: TEntity): Promise<Result<TEntity, PersistenceError | ConflictError>> {
      if (entity.workspaceId !== wsId) {
        return Promise.resolve(
          err(
            new PersistenceError(
              'UNKNOWN',
              `create: entity.workspaceId (${entity.workspaceId}) does not match context workspaceId (${wsId})`,
            ),
          ),
        );
      }
      return repo.create(entity);
    },

    update(
      id: string,
      changes: Partial<Omit<TEntity, 'id'>>,
      opts?: { expectedVersion?: number },
    ): Promise<Result<TEntity, PersistenceError | EntityNotFoundError | ConflictError>> {
      // We re-read via the scoped findById first so an update on a row from
      // another workspace returns EntityNotFoundError instead of silently succeeding.
      return repo.findOne(mergeFilter({ id: { _eq: id } } as Filter<TEntity>)).then((res) => {
        if (res.isErr()) return err(res.error);
        if (!res.value) return err(new EntityNotFoundError('entity', id));
        return repo.update(id, changes, opts);
      });
    },

    archive(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return repo.findOne(mergeFilter({ id: { _eq: id } } as Filter<TEntity>)).then((res) => {
        if (res.isErr()) return err(res.error);
        if (!res.value) return err(new EntityNotFoundError('entity', id));
        return repo.archive(id);
      });
    },

    hardDelete(id: string): Promise<Result<void, PersistenceError | EntityNotFoundError>> {
      return repo.findOne(mergeFilter({ id: { _eq: id } } as Filter<TEntity>)).then((res) => {
        if (res.isErr()) return err(res.error);
        if (!res.value) return err(new EntityNotFoundError('entity', id));
        return repo.hardDelete(id);
      });
    },
  };
}
