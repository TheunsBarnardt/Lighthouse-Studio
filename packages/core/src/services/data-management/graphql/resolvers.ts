import type { RequestContext } from '@platform/ports-authorization';
import type { CustomerRow, Sort } from '@platform/ports-persistence';

import { uuidv7 } from 'uuidv7';

import type {
  CustomerSchema,
  CustomerTableDefinition,
  ForeignKeyDefinition,
  ColumnDefinition,
} from '../schema-model.js';
import type { GraphQLContext } from './request-handler.js';

import { toAuditActor, auditMeta } from '../../../context.js';
import { WorkspaceContextRequiredError } from '../../../errors.js';
import { GRAPHQL_AUDIT_EVENTS } from '../audit-events.js';
import { makeConnection } from './connection.js';
import { adaptGraphQLFilter } from './filter-adapter.js';

// ── Context helpers ────────────────────────────────────────────────────────────

function requireWorkspaceId(ctx: RequestContext): string {
  if (!ctx.workspaceId) throw new WorkspaceContextRequiredError();
  return ctx.workspaceId;
}

function rowToStr(row: Record<string, unknown>, col: string): string {
  const v = row[col];
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

// ── Naming helpers ─────────────────────────────────────────────────────────────

function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toPascalCase(name: string): string {
  const c = toCamelCase(name);
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function getPrimaryKeyColumn(table: CustomerTableDefinition): ColumnDefinition {
  const pk = table.primaryKey;
  const colId = pk.kind === 'composite' ? pk.columnIds[0] : pk.columnId;
  if (!colId) throw new Error(`Primary key column not found for table ${table.name}`);
  const col = table.columns.find((c) => c.id === colId);
  if (!col) throw new Error(`Primary key column not found for table ${table.name}`);
  return col;
}

// ── Query resolvers ────────────────────────────────────────────────────────────

type QueryResolver<TArgs = Record<string, unknown>> = (
  parent: undefined,
  args: TArgs,
  ctx: GraphQLContext,
) => Promise<unknown>;

type FieldResolver<TParent = Record<string, unknown>, TArgs = Record<string, unknown>> = (
  parent: TParent,
  args: TArgs,
  ctx: GraphQLContext,
) => Promise<unknown>;

interface ListArgs {
  first?: number;
  after?: string;
  filter?: Record<string, unknown>;
  sort?: Array<Record<string, 'ASC' | 'DESC'>>;
  includeArchived?: boolean;
}

/** List resolver: returns a Relay-style connection for the table. */
export function listResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<ListArgs> {
  return async (_parent, args, ctx) => {
    await ctx.authz.authorize(
      ctx.ctx,
      'data_table.read',
      `data_table:${schema.slug}:${table.name}`,
    );

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const filter = args.filter ? adaptGraphQLFilter(args.filter, table) : undefined;

    const sort = buildSort(args.sort, table);
    const pageSize = Math.min(args.first ?? 50, 1000);
    const pkCol = getPrimaryKeyColumn(table);

    // Cursor → inject > last-seen-PK filter (same pattern as REST handler)
    let effectiveFilter = filter;
    if (args.after) {
      try {
        const decoded = JSON.parse(Buffer.from(args.after, 'base64url').toString('utf8')) as Record<
          string,
          unknown
        >;
        if (typeof decoded['val'] === 'string') {
          const cursorCond = { [pkCol.name]: { _gt: decoded['val'] } } as unknown as typeof filter;
          effectiveFilter = effectiveFilter
            ? ({ _and: [effectiveFilter, cursorCond] } as unknown as typeof filter)
            : cursorCond;
        }
      } catch {
        // Malformed cursor — ignore and fetch from start
      }
    }

    const findManyOpts: Parameters<typeof repo.findMany>[0] = {
      page: { limit: pageSize + 1, offset: 0 },
      includeArchived: args.includeArchived ?? false,
    };
    if (effectiveFilter !== undefined) findManyOpts.filter = effectiveFilter;
    if (sort !== undefined) findManyOpts.sort = sort;
    const result = await repo.findMany(findManyOpts);

    if (result.isErr()) throw result.error;
    const { items } = result.value;

    const hasNextPage = items.length > pageSize;
    const pageItems = hasNextPage ? items.slice(0, pageSize) : items;

    return makeConnection(pageItems, pkCol.name, hasNextPage, args.after);
  };
}

/** Get-one resolver: returns a single row by primary key. */
export function getOneResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<{ id: string }> {
  return async (_parent, args, ctx) => {
    await ctx.authz.authorize(
      ctx.ctx,
      'data_table.read',
      `data_table:${schema.slug}:${table.name}`,
    );

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const result = await repo.findById(args.id);
    if (result.isErr()) throw result.error;
    return result.value;
  };
}

/** Count resolver: returns the count of rows matching the filter. */
export function countResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<{ filter?: Record<string, unknown>; includeArchived?: boolean }> {
  return async (_parent, args, ctx) => {
    await ctx.authz.authorize(
      ctx.ctx,
      'data_table.read',
      `data_table:${schema.slug}:${table.name}`,
    );

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const filter = args.filter ? adaptGraphQLFilter(args.filter, table) : undefined;

    const result = await repo.count(filter ?? undefined);
    if (result.isErr()) throw result.error;
    return result.value;
  };
}

// ── Mutation resolvers ─────────────────────────────────────────────────────────

/** Create resolver: creates a new row and returns a tagged union result. */
export function createResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<{ input: Record<string, unknown> }> {
  return async (_parent, args, ctx) => {
    const authzResult = await ctx.authz.authorize(
      ctx.ctx,
      'data_table.create',
      `data_table:${schema.slug}:${table.name}`,
    );
    if (authzResult.isErr()) {
      return {
        __typename: 'AuthorizationError',
        message: 'You do not have permission to create records in this table.',
        requiredPermission: 'data_table.create',
      };
    }

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const entity = fromCamelCaseInput(args.input, table);
    const result = await repo.create({ id: uuidv7(), ...entity });

    if (result.isErr()) {
      const e = result.error;
      if ((e as unknown as { kind?: string }).kind === 'conflict') {
        return { __typename: 'ConflictError', message: e.message };
      }
      throw e;
    }

    const row = result.value;
    const entityField = toCamelCase(table.name);

    await ctx.audit.write({
      eventType: GRAPHQL_AUDIT_EVENTS.MUTATION_EXECUTED,
      actor: toAuditActor(ctx.ctx),
      workspaceId: requireWorkspaceId(ctx.ctx),
      resource: { type: 'data_table', id: `${schema.slug}:${table.name}` },
      action: 'create',
      outcome: 'success',
      correlationId: ctx.ctx.correlationId,
      metadata: {
        table: table.name,
        rowId: rowToStr(row, 'id'),
        operation: `create${toPascalCase(table.name)}`,
      },
      ...auditMeta(ctx.ctx),
    });

    return {
      __typename: `Create${toPascalCase(table.name)}Success`,
      [entityField]: row,
    };
  };
}

/** Update resolver: patches a row and returns a tagged union result. */
export function updateResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<{ id: string; input: Record<string, unknown>; expectedVersion?: number }> {
  return async (_parent, args, ctx) => {
    const authzResult = await ctx.authz.authorize(
      ctx.ctx,
      'data_table.update',
      `data_table:${schema.slug}:${table.name}`,
    );
    if (authzResult.isErr()) {
      return {
        __typename: 'AuthorizationError',
        message: 'You do not have permission to update records in this table.',
        requiredPermission: 'data_table.update',
      };
    }

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const changes = fromCamelCaseInput(args.input, table);
    const opts =
      args.expectedVersion !== undefined ? { expectedVersion: args.expectedVersion } : {};
    const result = await repo.update(args.id, changes, opts);

    if (result.isErr()) {
      const e = result.error;
      const kind = (e as unknown as { kind?: string }).kind;
      if (kind === 'conflict') {
        return { __typename: 'ConflictError', message: e.message };
      }
      if (kind === 'not_found') {
        return { __typename: 'ConflictError', message: `Record ${args.id} not found.` };
      }
      throw e;
    }

    const row = result.value;
    const entityField = toCamelCase(table.name);

    await ctx.audit.write({
      eventType: GRAPHQL_AUDIT_EVENTS.MUTATION_EXECUTED,
      actor: toAuditActor(ctx.ctx),
      workspaceId: requireWorkspaceId(ctx.ctx),
      resource: { type: 'data_table', id: `${schema.slug}:${table.name}` },
      action: 'update',
      outcome: 'success',
      correlationId: ctx.ctx.correlationId,
      metadata: {
        table: table.name,
        rowId: args.id,
        operation: `update${toPascalCase(table.name)}`,
      },
      ...auditMeta(ctx.ctx),
    });

    return {
      __typename: `Update${toPascalCase(table.name)}Success`,
      [entityField]: row,
    };
  };
}

/** Archive (soft-delete) resolver. */
export function archiveResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<{ id: string }> {
  return async (_parent, args, ctx) => {
    await ctx.authz.authorize(
      ctx.ctx,
      'data_table.delete',
      `data_table:${schema.slug}:${table.name}`,
    );

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const result = await repo.archive(args.id);
    if (result.isErr()) throw result.error;

    await ctx.audit.write({
      eventType: GRAPHQL_AUDIT_EVENTS.MUTATION_EXECUTED,
      actor: toAuditActor(ctx.ctx),
      workspaceId: requireWorkspaceId(ctx.ctx),
      resource: { type: 'data_table', id: `${schema.slug}:${table.name}` },
      action: 'archive',
      outcome: 'success',
      correlationId: ctx.ctx.correlationId,
      metadata: {
        table: table.name,
        rowId: args.id,
        operation: `archive${toPascalCase(table.name)}`,
      },
      ...auditMeta(ctx.ctx),
    });

    return true;
  };
}

/** Restore resolver (un-archive). */
export function restoreResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<{ id: string }> {
  return async (_parent, args, ctx) => {
    await ctx.authz.authorize(
      ctx.ctx,
      'data_table.update',
      `data_table:${schema.slug}:${table.name}`,
    );

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const result = await repo.restore(args.id);
    if (result.isErr()) throw result.error;

    await ctx.audit.write({
      eventType: GRAPHQL_AUDIT_EVENTS.MUTATION_EXECUTED,
      actor: toAuditActor(ctx.ctx),
      workspaceId: requireWorkspaceId(ctx.ctx),
      resource: { type: 'data_table', id: `${schema.slug}:${table.name}` },
      action: 'restore',
      outcome: 'success',
      correlationId: ctx.ctx.correlationId,
      metadata: {
        table: table.name,
        rowId: args.id,
        operation: `restore${toPascalCase(table.name)}`,
      },
      ...auditMeta(ctx.ctx),
    });

    return true;
  };
}

/** Hard-delete resolver (permanent removal). */
export function hardDeleteResolver(
  table: CustomerTableDefinition,
  schema: CustomerSchema,
): QueryResolver<{ id: string }> {
  return async (_parent, args, ctx) => {
    await ctx.authz.authorize(
      ctx.ctx,
      'data_table.delete',
      `data_table:${schema.slug}:${table.name}`,
    );

    const repoResult = ctx.repos.getRepository(requireWorkspaceId(ctx.ctx), schema, table.id);
    if (repoResult.isErr()) throw repoResult.error;
    const repo = repoResult.value;

    const result = await repo.hardDelete(args.id);
    if (result.isErr()) throw result.error;

    await ctx.audit.write({
      eventType: GRAPHQL_AUDIT_EVENTS.MUTATION_EXECUTED,
      actor: toAuditActor(ctx.ctx),
      workspaceId: requireWorkspaceId(ctx.ctx),
      resource: { type: 'data_table', id: `${schema.slug}:${table.name}` },
      action: 'hard_delete',
      outcome: 'success',
      correlationId: ctx.ctx.correlationId,
      metadata: {
        table: table.name,
        rowId: args.id,
        operation: `hardDelete${toPascalCase(table.name)}`,
      },
      ...auditMeta(ctx.ctx),
    });

    return true;
  };
}

// ── FK field resolvers ─────────────────────────────────────────────────────────

/** To-one FK resolver: loads a referenced row via DataLoader (N+1 prevention). */
export function foreignKeyToOneResolver(
  referencedTable: CustomerTableDefinition,
  fkColumnName: string,
): FieldResolver {
  return async (parent, _args, ctx) => {
    const fkValue = parent[fkColumnName];
    if (fkValue == null) return null;

    const loader = ctx.dataloaders.byId<CustomerRow>(referencedTable.id);
    return loader.load(
      typeof fkValue === 'string' || typeof fkValue === 'number' ? String(fkValue) : '',
    );
  };
}

/** To-many FK resolver: loads all referencing rows via DataLoader. */
export function foreignKeyToManyResolver(
  referencingTable: CustomerTableDefinition,
  fk: ForeignKeyDefinition,
): FieldResolver<Record<string, unknown>, { first?: number; after?: string }> {
  return async (parent, args, ctx) => {
    const fkColId = fk.columns[0];
    if (!fkColId) return makeConnection([], 'id', false, undefined);

    const referencedCol = referencingTable.columns.find((c) => c.id === fkColId);
    if (!referencedCol) return makeConnection([], 'id', false, undefined);

    const pkCol = getPrimaryKeyColumn(referencingTable);
    const parentId = rowToStr(parent, pkCol.name);

    const loader = ctx.dataloaders.byForeignKey<CustomerRow>(
      referencingTable.id,
      referencedCol.name,
    );
    const rows = await loader.load(parentId);

    const pageSize = Math.min(args.first ?? 50, 1000);
    const hasNextPage = rows.length > pageSize;
    const pageItems = hasNextPage ? rows.slice(0, pageSize) : rows;

    return makeConnection(pageItems, pkCol.name, hasNextPage, args.after);
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build Sort array from GraphQL sort input (array of { field: 'ASC' | 'DESC' } objects). */
function buildSort(
  sortInput: Array<Record<string, 'ASC' | 'DESC'>> | undefined,
  table: CustomerTableDefinition,
): Sort<CustomerRow> | undefined {
  if (!sortInput || sortInput.length === 0) return undefined;

  const colsByField = new Map(table.columns.map((c) => [toCamelCase(c.name), c.name]));
  const sort: Sort<CustomerRow> = {};

  for (const entry of sortInput) {
    for (const [field, dir] of Object.entries(entry)) {
      const colName = colsByField.get(field);
      if (colName) {
        (sort as Record<string, 'asc' | 'desc'>)[colName] = dir.toLowerCase() as 'asc' | 'desc';
      }
    }
  }

  return Object.keys(sort).length > 0 ? sort : undefined;
}

/** Convert camelCase GraphQL input fields to snake_case for the repository. */
function fromCamelCaseInput(
  input: Record<string, unknown>,
  table: CustomerTableDefinition,
): Record<string, unknown> {
  const colsByField = new Map(table.columns.map((c) => [toCamelCase(c.name), c.name]));
  const result: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(input)) {
    const colName = colsByField.get(field) ?? field;
    result[colName] = value;
  }

  return result;
}
