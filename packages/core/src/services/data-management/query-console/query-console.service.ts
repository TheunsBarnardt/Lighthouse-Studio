import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type {
  PaginatedResult,
  QueryLanguage,
  QueryPlan,
  RawQueryPort,
  RepositoryPort,
} from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../../../errors.js';
import type { QueryClassifierPort } from './classifier.js';
import type {
  ConfirmationRequired,
  ExecuteQueryInput,
  ExecuteQueryResult,
  ExplainQueryInput,
  ListHistoryOptions,
  ListSavedQueriesOptions,
  QueryHistoryRecord,
  SavedQuery,
  SaveQueryInput,
  UpdateSavedQueryInput,
} from './types.js';

import { auditMeta, toAuditActor } from '../../../context.js';
import { ForbiddenError, NotFoundError, TimeoutError, ValidationError } from '../../../errors.js';
import { observable } from '../../../observability/observable.js';
import { QUERY_AUDIT_EVENTS } from '../audit-events.js';
import { customerConsoleWriterRole, customerReadonlyRole } from '../namespace.js';
import { QUERY_DEFAULTS, QUERY_PERMISSIONS } from './permissions.js';

// Matches parameter names that are likely to contain PII (best-effort heuristic).
const PII_PARAM_PATTERNS =
  /\b(email|password|passwd|ssn|dob|date_of_birth|phone|mobile|credit_card|card_number|cvv|national_id|tax_id|passport|ip_address|ip_addr|address|street|zip|postcode|secret|token|api_key)\b/i;

// ── Input schemas ─────────────────────────────────────────────────────────────

const ExecuteQueryInputSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceSlug: z.string().min(1),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  query: z.string().min(1).max(1_000_000),
  language: z.enum(['sql_postgres', 'sql_mssql', 'mongo_aggregate', 'mongo_find']),
  parameters: z.record(z.unknown()).optional(),
  rowLimit: z.number().int().min(1).max(QUERY_DEFAULTS.MAX_ROW_LIMIT).optional(),
  timeoutMs: z.number().int().min(1000).max(QUERY_DEFAULTS.MAX_TIMEOUT_MS).optional(),
  confirmed: z.boolean().optional(),
});

const ExplainQueryInputSchema = z.object({
  workspaceId: z.string().uuid(),
  workspaceSlug: z.string().min(1),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  query: z.string().min(1).max(1_000_000),
  language: z.enum(['sql_postgres', 'sql_mssql', 'mongo_aggregate', 'mongo_find']),
  parameters: z.record(z.unknown()).optional(),
});

const SaveQueryInputSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  queryText: z.string().min(1),
  queryLanguage: z.enum(['sql_postgres', 'sql_mssql', 'mongo_aggregate', 'mongo_find']),
  defaultParameters: z.record(z.unknown()).optional(),
  folderPath: z.string().max(500).optional(),
  shared: z.boolean().optional(),
  sharedCanRun: z.boolean().optional(),
});

const UpdateSavedQueryInputSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(1),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  queryText: z.string().min(1).optional(),
  queryLanguage: z.enum(['sql_postgres', 'sql_mssql', 'mongo_aggregate', 'mongo_find']).optional(),
  defaultParameters: z.record(z.unknown()).optional(),
  folderPath: z.string().max(500).optional(),
  shared: z.boolean().optional(),
  sharedCanRun: z.boolean().optional(),
});

const ListHistoryOptionsSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(200),
  offset: z.number().int().min(0),
});

const ListSavedQueriesOptionsSchema = z.object({
  workspaceId: z.string().uuid(),
  includeShared: z.boolean().optional(),
  folderPath: z.string().optional(),
  limit: z.number().int().min(1).max(200),
  offset: z.number().int().min(0),
});

// ── Service ───────────────────────────────────────────────────────────────────

export class QueryConsoleService {
  // ── In-flight execution registry (executionId → AbortController) ─────────────
  // Keyed by executionId; stores controller + enough metadata to write a cancel history record.
  private readonly _inflight = new Map<
    string,
    {
      controller: AbortController;
      workspaceId: string;
      userId: string;
      queryText: string;
      queryLanguage: string;
      startedAt: Date;
    }
  >();

  // ── Public API (observable-wrapped) ─────────────────────────────────────────

  readonly execute!: (
    ctx: RequestContext,
    input: ExecuteQueryInput,
  ) => Promise<Result<ExecuteQueryResult, AppError>>;

  readonly explain!: (
    ctx: RequestContext,
    input: ExplainQueryInput,
  ) => Promise<Result<QueryPlan, AppError>>;

  readonly cancelExecution!: (
    ctx: RequestContext,
    executionId: string,
    workspaceId: string,
  ) => Promise<Result<void, AppError>>;

  readonly listHistory!: (
    ctx: RequestContext,
    opts: ListHistoryOptions,
  ) => Promise<Result<PaginatedResult<QueryHistoryRecord>, AppError>>;

  readonly deleteHistory!: (
    ctx: RequestContext,
    historyId: string,
    workspaceId: string,
  ) => Promise<Result<void, AppError>>;

  readonly saveQuery!: (
    ctx: RequestContext,
    input: SaveQueryInput,
  ) => Promise<Result<SavedQuery, AppError>>;

  readonly updateSavedQuery!: (
    ctx: RequestContext,
    input: UpdateSavedQueryInput,
  ) => Promise<Result<SavedQuery, AppError>>;

  readonly listSavedQueries!: (
    ctx: RequestContext,
    opts: ListSavedQueriesOptions,
  ) => Promise<Result<PaginatedResult<SavedQuery>, AppError>>;

  readonly getSavedQuery!: (
    ctx: RequestContext,
    queryId: string,
    workspaceId: string,
  ) => Promise<Result<SavedQuery, AppError>>;

  readonly deleteSavedQuery!: (
    ctx: RequestContext,
    queryId: string,
    workspaceId: string,
  ) => Promise<Result<void, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly classifier: QueryClassifierPort,
    private readonly executor: RawQueryPort,
    private readonly history: RepositoryPort<QueryHistoryRecord>,
    private readonly savedQueries: RepositoryPort<SavedQuery>,
    private readonly audit: AuditPort,
    logger: LoggerPort,
    metrics?: MetricsPort,
  ) {
    const obs = { logger, ...(metrics !== undefined ? { metrics } : {}) };
    const s = 'QueryConsoleService';
    this.execute = observable(s, 'execute', obs, this._execute.bind(this));
    this.explain = observable(s, 'explain', obs, this._explain.bind(this));
    this.cancelExecution = observable(s, 'cancelExecution', obs, this._cancelExecution.bind(this));
    this.listHistory = observable(s, 'listHistory', obs, this._listHistory.bind(this));
    this.deleteHistory = observable(s, 'deleteHistory', obs, this._deleteHistory.bind(this));
    this.saveQuery = observable(s, 'saveQuery', obs, this._saveQuery.bind(this));
    this.updateSavedQuery = observable(
      s,
      'updateSavedQuery',
      obs,
      this._updateSavedQuery.bind(this),
    );
    this.listSavedQueries = observable(
      s,
      'listSavedQueries',
      obs,
      this._listSavedQueries.bind(this),
    );
    this.getSavedQuery = observable(s, 'getSavedQuery', obs, this._getSavedQuery.bind(this));
    this.deleteSavedQuery = observable(
      s,
      'deleteSavedQuery',
      obs,
      this._deleteSavedQuery.bind(this),
    );
  }

  // ── Private implementations ──────────────────────────────────────────────────

  private async _execute(
    ctx: RequestContext,
    input: ExecuteQueryInput,
  ): Promise<Result<ExecuteQueryResult, AppError>> {
    // 1. Validate
    const parsed = ExecuteQueryInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid query input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }
    const data = parsed.data;

    // 2. Authorize — query.read is always required
    const readAuthz = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (readAuthz.isErr()) {
      return err(new ForbiddenError('query.read permission required to use the query console'));
    }

    // 3. Classify the query
    const classResult = this.classifier.classify({
      query: data.query,
      language: data.language as QueryLanguage,
    });
    if (classResult.isErr()) {
      return err(new ValidationError(`Query parse error: ${classResult.error.message}`));
    }
    const classification = classResult.value;

    // 4. Reject DDL in all modes
    if (classification.containsDdl) {
      await this.audit.write({
        eventType: QUERY_AUDIT_EVENTS.DDL_ATTEMPTED,
        workspaceId: data.workspaceId,
        actor: toAuditActor(ctx),
        resource: { type: 'query_console', id: data.workspaceId },
        action: 'ddl_attempted',
        outcome: 'denied',
        metadata: { ...auditMeta(ctx), queryLanguage: data.language },
        correlationId: ctx.correlationId,
      });
      return err(
        new ForbiddenError(
          'DDL statements (CREATE, ALTER, DROP, etc.) are not permitted in the query console. ' +
            'Use the Schema Designer to make schema changes.',
        ),
      );
    }

    // 5. Check write permission for non-read-only queries
    if (!classification.isReadOnly) {
      const writeAuthz = await this.authz.authorize(ctx, QUERY_PERMISSIONS.WRITE, 'workspace');
      if (writeAuthz.isErr()) {
        await this.audit.write({
          eventType: QUERY_AUDIT_EVENTS.WRITE_DENIED,
          workspaceId: data.workspaceId,
          actor: toAuditActor(ctx),
          resource: { type: 'query_console', id: data.workspaceId },
          action: 'write_denied',
          outcome: 'denied',
          metadata: { ...auditMeta(ctx), queryLanguage: data.language },
          correlationId: ctx.correlationId,
        });
        return err(new ForbiddenError('query.write permission required to execute write queries'));
      }

      // 6. For multi-statement writes or any write query, require UI confirmation
      if (!data.confirmed) {
        const confirmResult: ConfirmationRequired = {
          kind: 'confirmation_required',
          statementCount: classification.statementCount,
          affectedTables: classification.affectedTables,
          hasWriteStatements: true,
        };
        return ok(confirmResult);
      }
    }

    // 7. Resolve row limit and timeout with permission checks
    const rowLimit = await this._resolveRowLimit(ctx, data.rowLimit);
    const timeoutMs = await this._resolveTimeout(ctx, data.timeoutMs);

    // 8. Select database role
    const role = classification.isReadOnly ? 'readonly' : 'console_writer';
    const customerSchema =
      role === 'readonly'
        ? customerReadonlyRole(data.workspaceSlug)
        : customerConsoleWriterRole(data.workspaceSlug);

    // 9. Register AbortController for cancel support
    const executionId = uuidv7();
    const abortController = new AbortController();
    this._inflight.set(executionId, {
      controller: abortController,
      workspaceId: data.workspaceId,
      userId: ctx.userId,
      queryText: data.query,
      queryLanguage: data.language,
      startedAt: new Date(),
    });

    // 10. Execute — wrap in transaction for confirmed multi-statement or write queries
    const wrapInTransaction = !classification.isReadOnly && !!data.confirmed;
    const start = Date.now();
    const execResult = await this.executor.execute({
      workspaceId: data.workspaceId,
      customerSchema,
      query: data.query,
      parameters: data.parameters ?? {},
      language: data.language as QueryLanguage,
      role,
      timeoutMs,
      rowLimit,
      abortSignal: abortController.signal,
      wrapInTransaction,
    });
    this._inflight.delete(executionId);

    const durationMs = Date.now() - start;
    const cancelled = execResult.isErr() && execResult.error.code === 'CANCELLED';
    const status = execResult.isOk()
      ? 'succeeded'
      : execResult.error.code === 'TIMEOUT'
        ? 'timeout'
        : cancelled
          ? 'cancelled'
          : 'failed';

    // 11. Record in history (redact PII-named params)
    const historyRecord: QueryHistoryRecord = {
      id: uuidv7(),
      version: 1,
      workspaceId: data.workspaceId,
      userId: ctx.userId,
      queryText: data.query,
      queryLanguage: data.language as QueryLanguage,
      parameters: this._redactPiiParams(data.parameters ?? {}, classification.parameterNames),
      durationMs,
      rowsAffected: execResult.isOk() ? execResult.value.rowCount : null,
      errorMessage: execResult.isErr() ? execResult.error.message : null,
      status,
      resultSummary: execResult.isOk()
        ? {
            columns: execResult.value.columns,
            rowCount: execResult.value.rowCount,
            truncated: execResult.value.truncated,
          }
        : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };
    await this.history.create(historyRecord);

    // 11. Audit
    const auditEvent = classification.isReadOnly
      ? QUERY_AUDIT_EVENTS.EXECUTED
      : QUERY_AUDIT_EVENTS.EXECUTED_WRITE;

    await this.audit.write({
      eventType:
        status === 'timeout'
          ? QUERY_AUDIT_EVENTS.TIMED_OUT
          : status === 'failed'
            ? QUERY_AUDIT_EVENTS.FAILED
            : auditEvent,
      workspaceId: data.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'query_console', id: data.workspaceId },
      action: status === 'succeeded' ? 'executed' : status,
      outcome: status === 'succeeded' ? 'success' : 'failure',
      metadata: {
        ...auditMeta(ctx),
        queryLanguage: data.language,
        statementCount: classification.statementCount,
        durationMs,
        ...(execResult.isOk() && { rowCount: execResult.value.rowCount }),
        affectedTables: classification.affectedTables,
      },
      correlationId: ctx.correlationId,
    });

    // 12. Return
    if (execResult.isErr()) {
      const e = execResult.error;
      if (e.code === 'TIMEOUT') {
        return err(new TimeoutError(`Query timed out after ${String(timeoutMs)}ms`));
      }
      return err(new ValidationError(e.message));
    }

    const r = execResult.value;
    return ok({
      kind: 'result' as const,
      executionId,
      rows: r.rows,
      rowCount: r.rowCount,
      truncated: r.truncated,
      durationMs: r.durationMs,
      columns: r.columns,
      statementsAffected: r.statementsAffected,
    });
  }

  private async _cancelExecution(
    ctx: RequestContext,
    executionId: string,
    workspaceId: string,
  ): Promise<Result<void, AppError>> {
    const authResult = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError('query.read permission required'));
    }

    const inflight = this._inflight.get(executionId);
    if (!inflight) {
      // Already completed or never existed — treat as success
      return ok(undefined);
    }

    inflight.controller.abort();
    this._inflight.delete(executionId);

    const now = new Date();
    const durationMs = now.getTime() - inflight.startedAt.getTime();

    // Write cancelled history record
    await this.history.create({
      id: uuidv7(),
      version: 1,
      workspaceId: inflight.workspaceId,
      userId: inflight.userId,
      queryText: inflight.queryText,
      queryLanguage: inflight.queryLanguage as QueryLanguage,
      parameters: null,
      durationMs,
      rowsAffected: null,
      errorMessage: 'Query cancelled by user',
      status: 'cancelled',
      resultSummary: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    await this.audit.write({
      eventType: QUERY_AUDIT_EVENTS.CANCELLED,
      workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'query_console', id: workspaceId },
      action: 'cancelled',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), executionId, durationMs },
      correlationId: ctx.correlationId,
    });

    return ok(undefined);
  }

  private async _explain(
    ctx: RequestContext,
    input: ExplainQueryInput,
  ): Promise<Result<QueryPlan, AppError>> {
    // 1. Validate
    const parsed = ExplainQueryInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid explain input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }
    const data = parsed.data;

    // 2. Authorize (EXPLAIN requires query.read at minimum)
    const authResult = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError('query.read permission required'));
    }

    const execResult = await this.executor.explain({
      workspaceId: data.workspaceId,
      customerSchema: customerReadonlyRole(data.workspaceSlug),
      query: data.query,
      parameters: data.parameters ?? {},
      language: data.language as QueryLanguage,
      role: 'readonly',
      timeoutMs: QUERY_DEFAULTS.TIMEOUT_MS,
      rowLimit: QUERY_DEFAULTS.ROW_LIMIT,
    });

    if (execResult.isErr()) {
      return err(new ValidationError(execResult.error.message));
    }

    return ok(execResult.value);
  }

  private async _listHistory(
    ctx: RequestContext,
    opts: ListHistoryOptions,
  ): Promise<Result<PaginatedResult<QueryHistoryRecord>, AppError>> {
    const parsed = ListHistoryOptionsSchema.safeParse(opts);
    if (!parsed.success) {
      return err(new ValidationError('Invalid options'));
    }

    const authResult = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError('query.read permission required'));
    }

    const userId = parsed.data.userId ?? ctx.userId;
    const result = await this.history.findMany({
      filter: {
        workspaceId: { _eq: parsed.data.workspaceId },
        userId: { _eq: userId },
        deletedAt: { _is_null: true },
      } as never,
      sort: { createdAt: 'desc' } as never,
      page: { limit: parsed.data.limit, offset: parsed.data.offset },
    });

    if (result.isErr()) {
      return err(new ValidationError(result.error.message));
    }

    return ok(result.value);
  }

  private async _deleteHistory(
    ctx: RequestContext,
    historyId: string,
    workspaceId: string,
  ): Promise<Result<void, AppError>> {
    const authResult = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError('query.read permission required'));
    }

    const existing = await this.history.findById(historyId);
    if (existing.isErr()) return err(new NotFoundError('QueryHistory', historyId));
    if (!existing.value) return err(new NotFoundError('QueryHistory', historyId));
    if (existing.value.workspaceId !== workspaceId || existing.value.userId !== ctx.userId) {
      return err(new ForbiddenError("Cannot delete another user's history entry"));
    }

    const delResult = await this.history.archive(historyId);
    if (delResult.isErr()) return err(new ValidationError(delResult.error.message));
    return ok(undefined);
  }

  private async _saveQuery(
    ctx: RequestContext,
    input: SaveQueryInput,
  ): Promise<Result<SavedQuery, AppError>> {
    const parsed = SaveQueryInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid saved query input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }
    const data = parsed.data;

    const authResult = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError('query.read permission required to save queries'));
    }

    const now = new Date();
    const savedQuery: SavedQuery = {
      id: uuidv7(),
      version: 1,
      workspaceId: data.workspaceId,
      createdByUserId: ctx.userId,
      name: data.name,
      description: data.description ?? null,
      queryText: data.queryText,
      queryLanguage: data.queryLanguage as QueryLanguage,
      defaultParameters: data.defaultParameters ?? null,
      folderPath: data.folderPath ?? null,
      shared: data.shared ?? false,
      sharedCanRun: data.sharedCanRun ?? false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const createResult = await this.savedQueries.create(savedQuery);
    if (createResult.isErr()) {
      return err(new ValidationError(createResult.error.message));
    }

    await this.audit.write({
      eventType: QUERY_AUDIT_EVENTS.SAVED,
      workspaceId: data.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'saved_query', id: savedQuery.id },
      action: 'saved',
      outcome: 'success',
      metadata: {
        ...auditMeta(ctx),
        name: data.name,
        ...(data.shared !== undefined && { shared: data.shared }),
      },
      correlationId: ctx.correlationId,
    });

    return ok(savedQuery);
  }

  private async _updateSavedQuery(
    ctx: RequestContext,
    input: UpdateSavedQueryInput,
  ): Promise<Result<SavedQuery, AppError>> {
    const parsed = UpdateSavedQueryInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid update input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }
    const data = parsed.data;

    const existing = await this.savedQueries.findById(data.id);
    if (existing.isErr() || !existing.value) {
      return err(new NotFoundError('SavedQuery', data.id));
    }
    const sq = existing.value;

    if (sq.workspaceId !== data.workspaceId || sq.createdByUserId !== ctx.userId) {
      return err(new ForbiddenError('Only the query owner can update it'));
    }

    const changes: Partial<Omit<SavedQuery, 'id'>> = {
      version: sq.version + 1,
      name: data.name ?? sq.name,
      description: data.description !== undefined ? data.description : sq.description,
      queryText: data.queryText ?? sq.queryText,
      queryLanguage: data.queryLanguage ?? sq.queryLanguage,
      defaultParameters:
        data.defaultParameters !== undefined ? data.defaultParameters : sq.defaultParameters,
      folderPath: data.folderPath !== undefined ? data.folderPath : sq.folderPath,
      shared: data.shared !== undefined ? data.shared : sq.shared,
      sharedCanRun: data.sharedCanRun !== undefined ? data.sharedCanRun : sq.sharedCanRun,
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };

    const updateResult = await this.savedQueries.update(sq.id, changes, {
      expectedVersion: sq.version,
    });
    if (updateResult.isErr()) {
      return err(new ValidationError(updateResult.error.message));
    }
    const updated = updateResult.value;

    if (data.shared !== undefined && data.shared !== sq.shared) {
      await this.audit.write({
        eventType: QUERY_AUDIT_EVENTS.SHARED,
        workspaceId: data.workspaceId,
        actor: toAuditActor(ctx),
        resource: { type: 'saved_query', id: data.id },
        action: data.shared ? 'shared' : 'unshared',
        outcome: 'success',
        metadata: {
          ...auditMeta(ctx),
          ...(data.sharedCanRun !== undefined && { sharedCanRun: data.sharedCanRun }),
        },
        correlationId: ctx.correlationId,
      });
    }

    return ok(updated);
  }

  private async _listSavedQueries(
    ctx: RequestContext,
    opts: ListSavedQueriesOptions,
  ): Promise<Result<PaginatedResult<SavedQuery>, AppError>> {
    const parsed = ListSavedQueriesOptionsSchema.safeParse(opts);
    if (!parsed.success) {
      return err(new ValidationError('Invalid options'));
    }

    const authResult = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError('query.read permission required'));
    }

    const data = parsed.data;

    // Build filter: my queries + shared queries (if requested)
    const filter = data.includeShared
      ? ({ workspaceId: { _eq: data.workspaceId }, deletedAt: { _is_null: true } } as never)
      : ({
          workspaceId: { _eq: data.workspaceId },
          createdByUserId: { _eq: ctx.userId },
          deletedAt: { _is_null: true },
        } as never);

    const result = await this.savedQueries.findMany({
      filter,
      sort: { name: 'asc' } as never,
      page: { limit: data.limit, offset: data.offset },
    });

    if (result.isErr()) {
      return err(new ValidationError(result.error.message));
    }

    return ok(result.value);
  }

  private async _getSavedQuery(
    ctx: RequestContext,
    queryId: string,
    workspaceId: string,
  ): Promise<Result<SavedQuery, AppError>> {
    const authResult = await this.authz.authorize(ctx, QUERY_PERMISSIONS.READ, 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError('query.read permission required'));
    }

    const result = await this.savedQueries.findById(queryId);
    if (result.isErr() || !result.value) {
      return err(new NotFoundError('SavedQuery', queryId));
    }

    const sq = result.value;
    if (sq.workspaceId !== workspaceId) {
      return err(new NotFoundError('SavedQuery', queryId));
    }

    // Check visibility: owner sees their own; others can only see shared queries
    if (sq.createdByUserId !== ctx.userId && !sq.shared) {
      return err(new NotFoundError('SavedQuery', queryId));
    }

    return ok(sq);
  }

  private async _deleteSavedQuery(
    ctx: RequestContext,
    queryId: string,
    workspaceId: string,
  ): Promise<Result<void, AppError>> {
    const existing = await this.savedQueries.findById(queryId);
    if (existing.isErr() || !existing.value) {
      return err(new NotFoundError('SavedQuery', queryId));
    }
    const sq = existing.value;

    if (sq.workspaceId !== workspaceId || sq.createdByUserId !== ctx.userId) {
      return err(new ForbiddenError('Only the query owner can delete it'));
    }

    const delResult = await this.savedQueries.archive(queryId);
    if (delResult.isErr()) return err(new ValidationError(delResult.error.message));

    await this.audit.write({
      eventType: QUERY_AUDIT_EVENTS.DELETED_SAVE,
      workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'saved_query', id: queryId },
      action: 'deleted',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), name: sq.name },
      correlationId: ctx.correlationId,
    });

    return ok(undefined);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async _resolveRowLimit(
    ctx: RequestContext,
    requested: number | undefined,
  ): Promise<number> {
    if (!requested) return QUERY_DEFAULTS.ROW_LIMIT;

    if (requested > QUERY_DEFAULTS.ROW_LIMIT) {
      const largeResult = await this.authz.authorize(
        ctx,
        QUERY_PERMISSIONS.LARGE_RESULT,
        'workspace',
      );
      if (largeResult.isErr()) return QUERY_DEFAULTS.ROW_LIMIT;
    }

    return Math.min(requested, QUERY_DEFAULTS.MAX_ROW_LIMIT);
  }

  private async _resolveTimeout(
    ctx: RequestContext,
    requested: number | undefined,
  ): Promise<number> {
    if (!requested) return QUERY_DEFAULTS.TIMEOUT_MS;

    if (requested > QUERY_DEFAULTS.TIMEOUT_MS) {
      const longRunning = await this.authz.authorize(
        ctx,
        QUERY_PERMISSIONS.LONG_RUNNING,
        'workspace',
      );
      if (longRunning.isErr()) return QUERY_DEFAULTS.TIMEOUT_MS;
    }

    return Math.min(requested, QUERY_DEFAULTS.MAX_TIMEOUT_MS);
  }

  // Redact values for parameter names that look like PII fields.
  // Best-effort heuristic: checks against known PII field name patterns.
  // Full accuracy requires SchemaService PII column registry (future wiring).
  private _redactPiiParams(
    parameters: Record<string, unknown>,
    paramNames: string[],
  ): Record<string, unknown> | null {
    if (paramNames.length === 0) return null;
    const redacted: Record<string, unknown> = {};
    let anyRedacted = false;
    for (const name of paramNames) {
      if (PII_PARAM_PATTERNS.test(name)) {
        redacted[name] = '[REDACTED]';
        anyRedacted = true;
      } else {
        redacted[name] = parameters[name];
      }
    }
    return anyRedacted ? redacted : parameters;
  }
}
