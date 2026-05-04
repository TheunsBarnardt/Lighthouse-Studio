import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort, MetricsPort, TracerPort } from '@platform/ports-observability';
import type {
  CustomerRow,
  CustomerTableRepository,
  Filter,
  RepositoryPort,
  Sort,
} from '@platform/ports-persistence';
import type { RateLimiterPort } from '@platform/ports-rate-limiter';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

import type { AppError } from '../../errors.js';
import type { IdempotencyRecord } from '../../idempotency/types.js';
import type { ApiKeyPrincipal } from './api-key.service.js';
import type { PerWorkspaceRepositoryFactory } from './per-workspace-repository-factory.js';
import type { CustomerSchema, CustomerTableDefinition, PiiCategory } from './schema-model.js';
import type { SchemaService } from './schema.service.js';

import { toAuditActor, auditMeta } from '../../context.js';
import { NotFoundError, ValidationError, WorkspaceContextRequiredError } from '../../errors.js';
import { withIdempotency } from '../../idempotency/idempotency.helper.js';
import { API_AUDIT_EVENTS } from './audit-events.js';
import { FilterParserImpl } from './filter-parser.js';

// ── Public API types ────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequest {
  method: HttpMethod;
  params: {
    workspaceSlug: string;
    schemaSlug: string;
    table: string;
    id?: string;
    subresource?: 'bulk' | 'count' | 'restore';
  };
  queryParams: Record<string, string | string[]>;
  body: unknown;
  ctx: RequestContext;
  principal: ApiKeyPrincipal | null;
}

export interface ApiResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
}

// ── Internal request context passed through the dispatch chain ─────────────────

interface DispatchContext {
  ctx: RequestContext;
  /** Narrowed non-undefined workspaceId. */
  workspaceId: string;
  schema: CustomerSchema;
  table: CustomerTableDefinition;
  repo: CustomerTableRepository;
  queryParams: Record<string, string | string[]>;
  body: unknown;
  params: ApiRequest['params'];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_RATE_LIMIT_CAPACITY = 1000;
const DEFAULT_RATE_LIMIT_REFILL = 1000 / 60;
const BULK_COST = 10;

// ── Cursor pagination helpers ──────────────────────────────────────────────────

function encodeCursor(pkCol: string, pkVal: unknown): string {
  const json = JSON.stringify({ col: pkCol, val: String(pkVal) });
  return Buffer.from(json).toString('base64url');
}

function decodeCursor(cursor: string): { col: string; val: string } | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { col, val } = parsed as Record<string, unknown>;
    if (typeof col !== 'string' || typeof val !== 'string') return null;
    return { col, val };
  } catch {
    return null;
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export class ApiRequestHandler {
  private readonly filterParser = new FilterParserImpl();
  private _activeRequests = 0;

  constructor(
    private readonly schemas: SchemaService,
    private readonly authz: AuthorizationPort,
    private readonly repos: PerWorkspaceRepositoryFactory,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly rateLimiter: RateLimiterPort,
    private readonly metrics: MetricsPort,
    private readonly idempotencyRepo: RepositoryPort<IdempotencyRecord>,
    private readonly tracer: TracerPort,
  ) {}

  async handle(request: ApiRequest): Promise<Result<ApiResponse, AppError>> {
    const { params } = request;

    return this.tracer.withSpan(
      `data_api.${request.method.toLowerCase()}.${params.table}`,
      (span) => {
        span.setAttributes({
          'workspace.slug': params.workspaceSlug,
          'schema.slug': params.schemaSlug,
          'table.name': params.table,
          'http.method': request.method,
        });
        return this._handle(request);
      },
    );
  }

  private async _handle(request: ApiRequest): Promise<Result<ApiResponse, AppError>> {
    const start = Date.now();
    const { ctx, params } = request;
    const metricAttrs = {
      workspace: params.workspaceSlug,
      table: params.table,
      method: request.method,
    };

    this.metrics
      .counter('platform_api_requests_total', { description: 'Total customer API requests' })
      .add(1, metricAttrs);
    this._activeRequests += 1;
    this.metrics
      .gauge('platform_api_active_requests', { description: 'In-flight customer API requests' })
      .set(this._activeRequests, metricAttrs);

    try {
      if (!ctx.workspaceId) {
        return err(new WorkspaceContextRequiredError());
      }
      const workspaceId: string = ctx.workspaceId;

      // 1. Rate limit
      const isBulk = params.subresource === 'bulk';
      const bucketKey = `workspace:${params.workspaceSlug}:principal:${ctx.userId}`;
      const rlResult = await this.rateLimiter.check({
        bucketKey,
        capacity: DEFAULT_RATE_LIMIT_CAPACITY,
        refillRate: DEFAULT_RATE_LIMIT_REFILL,
        cost: isBulk ? BULK_COST : 1,
      });

      if (rlResult.isOk() && !rlResult.value.allowed) {
        this.metrics
          .counter('platform_api_rate_limit_rejections_total', {
            description: 'Rate-limited customer API requests',
          })
          .add(1, metricAttrs);
        await this.audit.write({
          eventType: API_AUDIT_EVENTS.RATE_LIMITED,
          actor: toAuditActor(ctx),
          workspaceId,
          resource: { type: 'api', id: params.table },
          action: 'rate_limited',
          outcome: 'failure',
          correlationId: ctx.correlationId,
          metadata: { retryAfterMs: rlResult.value.retryAfterMs ?? 60000 },
          ...auditMeta(ctx),
        });
        return ok({
          statusCode: 429,
          body: {
            type: 'https://platform.example.com/errors/rate_limited',
            title: 'Too Many Requests',
            status: 429,
            detail: `Rate limit exceeded. Retry after ${String(rlResult.value.retryAfterMs ?? 60000)}ms.`,
            correlationId: ctx.correlationId,
          },
          headers: {
            'Retry-After': String(Math.ceil((rlResult.value.retryAfterMs ?? 60000) / 1000)),
            'Content-Type': 'application/problem+json',
          },
        });
      }

      // 2. Resolve schema
      const schemaResult = await this.schemas.resolveDeployedSchema(ctx, params.schemaSlug);
      if (schemaResult.isErr()) return err(schemaResult.error);
      const schema = schemaResult.value;

      // 3. Resolve table
      const table = schema.tables.find((t) => t.name === params.table);
      if (!table) {
        return err(new NotFoundError('Table', `${params.schemaSlug}:${params.table}`));
      }

      // 4. Authorize at table level
      const operation = this.operationAction(request.method, params);
      const authzResult = await this.authz.authorize(
        ctx,
        `data_table.${operation}`,
        `data_table:${params.schemaSlug}:${params.table}`,
      );
      if (authzResult.isErr()) {
        await this.audit.write({
          eventType: API_AUDIT_EVENTS.READ_DENIED,
          actor: toAuditActor(ctx),
          workspaceId,
          resource: { type: 'data_table', id: `${params.schemaSlug}:${params.table}` },
          action: operation,
          outcome: 'denied',
          correlationId: ctx.correlationId,
          ...auditMeta(ctx),
        });
        return ok({
          statusCode: 403,
          body: {
            type: 'https://platform.example.com/errors/forbidden',
            title: 'Forbidden',
            status: 403,
            detail: `Missing '${operation}' permission on table '${params.table}'.`,
            correlationId: ctx.correlationId,
          },
          headers: { 'Content-Type': 'application/problem+json' },
        });
      }

      // 5. Get repository
      const repoResult = this.repos.getRepository(params.workspaceSlug, schema, table.id);
      if (repoResult.isErr()) return err(repoResult.error);

      const dc: DispatchContext = {
        ctx,
        workspaceId,
        schema,
        table,
        repo: repoResult.value,
        queryParams: request.queryParams,
        body: request.body,
        params,
      };

      // 6. Dispatch
      const result = await this.dispatch(request.method, dc);

      // 7. Metrics
      const durationSec = (Date.now() - start) / 1000;
      this.metrics
        .histogram('platform_api_request_duration_seconds', {
          description: 'Customer API request duration',
        })
        .record(durationSec, metricAttrs);

      if (result.isOk()) {
        const bodyJson = JSON.stringify(result.value.body ?? null);
        this.metrics
          .histogram('platform_api_response_size_bytes', {
            description: 'Customer API response body size in bytes',
          })
          .record(bodyJson.length, metricAttrs);

        if (result.value.statusCode === 400) {
          this.metrics
            .counter('platform_api_validation_errors_total', {
              description: 'Customer API validation errors',
            })
            .add(1, metricAttrs);
        }
      }

      if (durationSec > 10) {
        this.logger.error('Slow API request', {
          ...metricAttrs,
          duration_ms: durationSec * 1000,
          correlationId: ctx.correlationId,
        });
      } else if (durationSec > 2) {
        this.logger.warn('Slow API request', {
          ...metricAttrs,
          duration_ms: durationSec * 1000,
          correlationId: ctx.correlationId,
        });
      }

      return result;
    } finally {
      this._activeRequests -= 1;
      this.metrics
        .gauge('platform_api_active_requests', { description: 'In-flight customer API requests' })
        .set(this._activeRequests, metricAttrs);
    }
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────────

  private async dispatch(
    method: HttpMethod,
    dc: DispatchContext,
  ): Promise<Result<ApiResponse, AppError>> {
    const { subresource, id } = dc.params;

    if (subresource === 'count' && method === 'GET') return this.handleCount(dc);

    // Mutating operations — eligible for idempotency deduplication
    const isMutating =
      method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

    if (!isMutating) {
      if (id) return this.handleGetOne(dc, id);
      return this.handleList(dc);
    }

    // Determine the operation handler before wrapping
    const getWork = (): (() => Promise<Result<ApiResponse, AppError>>) => {
      if (subresource === 'bulk' && method === 'POST') return () => this.handleBulkCreate(dc);
      if (subresource === 'restore' && id && method === 'POST')
        return () => this.handleRestore(dc, id);
      if (id) {
        if (method === 'PUT' || method === 'PATCH') return () => this.handleUpdate(dc, id);
        if (method === 'DELETE') return () => this.handleDelete(dc, id);
      }
      if (method === 'POST') return () => this.handleCreate(dc);
      if (method === 'PATCH') return () => this.handleBulkUpdate(dc);
      if (method === 'DELETE') return () => this.handleBulkDelete(dc);
      return () =>
        Promise.resolve(err(new ValidationError(`Method ${method} not supported for this path`)));
    };

    const operationTag = `${dc.schema.slug}.${dc.table.name}.${method}${subresource ? `.${subresource}` : ''}${id ? '.byId' : ''}`;

    return withIdempotency(
      {
        repo: this.idempotencyRepo,
        operation: `DataApi.${operationTag}`,
        workspaceId: dc.workspaceId,
        idempotencyKey: dc.ctx.idempotencyKey,
        id: uuidv7,
      },
      getWork(),
    );
  }

  // ── List ──────────────────────────────────────────────────────────────────────

  private async handleList(dc: DispatchContext): Promise<Result<ApiResponse, AppError>> {
    const filterResult = this.filterParser.parse(dc.queryParams, dc.table);
    if (filterResult.isErr()) return ok(this.validationError(dc.ctx, filterResult.error.message));

    const limit = Math.min(Number(dc.queryParams['limit'] ?? 50), 1000);
    const includeArchived = dc.queryParams['include_archived'] === 'true';
    const sort = this.parseSort(dc.queryParams, dc.table);

    // Cursor pagination — takes precedence over offset when present
    const rawCursor = dc.queryParams['cursor'];
    const cursorStr = rawCursor ? (Array.isArray(rawCursor) ? rawCursor[0] : rawCursor) : undefined;
    const cursor = cursorStr ? decodeCursor(cursorStr) : null;
    const pkCol = this.resolvePkColumn(dc.table);

    let offset = Number(dc.queryParams['offset'] ?? 0);
    let baseFilter = filterResult.value;

    if (cursor && pkCol && cursor.col === pkCol) {
      // Inject > last-seen PK into filter; reset offset to 0 (cursor is positional)
      offset = 0;
      const cursorCond = { [pkCol]: { _gt: cursor.val } } as Filter<CustomerRow>;
      baseFilter = baseFilter
        ? ({ _and: [baseFilter, cursorCond] } as Filter<CustomerRow>)
        : cursorCond;
    }

    const result = await dc.repo.findMany({
      filter: baseFilter as never,
      ...(sort !== undefined ? { sort } : {}),
      page: { limit, offset },
      includeArchived,
    });
    if (result.isErr()) return err(result.error as AppError);

    // Encode next cursor from last item's PK if a full page was returned
    let nextCursor: string | null = null;
    if (pkCol && result.value.items.length === limit) {
      const lastItem = result.value.items[result.value.items.length - 1];
      if (lastItem && lastItem[pkCol] !== undefined) {
        nextCursor = encodeCursor(pkCol, lastItem[pkCol]);
      }
    }

    const fields = this.parseFields(dc.queryParams);
    const { redacted, rows: shaped } = await this.shapeRows(result.value.items, dc);
    const items = fields ? shaped.map((r) => this.projectFields(r, fields)) : shaped;

    const responseHeaders: Record<string, string> = {};
    if (offset > 1000) {
      responseHeaders['X-Pagination-Performance-Warning'] =
        'offset-based pagination is slow at large offsets; switch to cursor pagination';
    }

    return ok({
      statusCode: 200,
      ...(Object.keys(responseHeaders).length > 0 ? { headers: responseHeaders } : {}),
      body: {
        data: items,
        meta: {
          total: result.value.total,
          limit: result.value.limit,
          offset: result.value.offset,
          nextCursor,
          ...(redacted.length > 0 ? { redacted } : {}),
        },
      },
    });
  }

  // ── GetOne ────────────────────────────────────────────────────────────────────

  private async handleGetOne(
    dc: DispatchContext,
    id: string,
  ): Promise<Result<ApiResponse, AppError>> {
    const result = await dc.repo.findById(id);
    if (result.isErr()) return err(result.error as AppError);
    if (!result.value) return err(new NotFoundError(dc.table.name, id));

    const fields = this.parseFields(dc.queryParams);
    const { redacted, rows } = await this.shapeRows([result.value], dc);
    const shaped = rows[0] ?? result.value;
    const projected = fields ? this.projectFields(shaped, fields) : shaped;

    const body = redacted.length > 0 ? { ...projected, _meta: { redacted } } : projected;
    return ok({ statusCode: 200, body });
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  private async handleCreate(dc: DispatchContext): Promise<Result<ApiResponse, AppError>> {
    if (typeof dc.body !== 'object' || dc.body === null || Array.isArray(dc.body)) {
      return ok(this.validationError(dc.ctx, 'Request body must be a JSON object'));
    }
    const result = await dc.repo.create(dc.body as CustomerRow);
    if (result.isErr()) return err(result.error as AppError);

    await this.audit.write({
      eventType: API_AUDIT_EVENTS.ROW_CREATED,
      actor: toAuditActor(dc.ctx),
      workspaceId: dc.workspaceId,
      resource: {
        type: `${dc.schema.slug}.${dc.table.name}`,
        id:
          typeof result.value['id'] === 'string' || typeof result.value['id'] === 'number'
            ? String(result.value['id'])
            : '',
      },
      action: 'created',
      outcome: 'success',
      correlationId: dc.ctx.correlationId,
      ...auditMeta(dc.ctx),
    });
    return ok({ statusCode: 201, body: result.value });
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  private async handleUpdate(
    dc: DispatchContext,
    id: string,
  ): Promise<Result<ApiResponse, AppError>> {
    if (typeof dc.body !== 'object' || dc.body === null || Array.isArray(dc.body)) {
      return ok(this.validationError(dc.ctx, 'Request body must be a JSON object'));
    }
    const changes = dc.body as CustomerRow;
    const rawVersion = dc.queryParams['_version'];
    const rawVersionStr = Array.isArray(rawVersion) ? rawVersion[0] : rawVersion;
    const expectedVersion = rawVersionStr !== undefined ? Number(rawVersionStr) : undefined;

    const result = await dc.repo.update(
      id,
      changes,
      expectedVersion !== undefined ? { expectedVersion } : {},
    );
    if (result.isErr()) return err(result.error as AppError);

    await this.audit.write({
      eventType: API_AUDIT_EVENTS.ROW_UPDATED,
      actor: toAuditActor(dc.ctx),
      workspaceId: dc.workspaceId,
      resource: { type: `${dc.schema.slug}.${dc.table.name}`, id },
      action: 'updated',
      outcome: 'success',
      correlationId: dc.ctx.correlationId,
      metadata: { changes: Object.keys(changes) },
      ...auditMeta(dc.ctx),
    });
    return ok({ statusCode: 200, body: result.value });
  }

  // ── Delete / Archive ──────────────────────────────────────────────────────────

  private async handleDelete(
    dc: DispatchContext,
    id: string,
  ): Promise<Result<ApiResponse, AppError>> {
    const isHard = dc.queryParams['hard'] === 'true';

    if (isHard) {
      const r = await dc.repo.hardDelete(id);
      if (r.isErr()) return err(r.error as AppError);
      await this.audit.write({
        eventType: API_AUDIT_EVENTS.ROW_HARD_DELETED,
        actor: toAuditActor(dc.ctx),
        workspaceId: dc.workspaceId,
        resource: { type: `${dc.schema.slug}.${dc.table.name}`, id },
        action: 'hard_deleted',
        outcome: 'success',
        correlationId: dc.ctx.correlationId,
        ...auditMeta(dc.ctx),
      });
    } else {
      const r = await dc.repo.archive(id);
      if (r.isErr()) return err(r.error as AppError);
      await this.audit.write({
        eventType: API_AUDIT_EVENTS.ROW_ARCHIVED,
        actor: toAuditActor(dc.ctx),
        workspaceId: dc.workspaceId,
        resource: { type: `${dc.schema.slug}.${dc.table.name}`, id },
        action: 'archived',
        outcome: 'success',
        correlationId: dc.ctx.correlationId,
        ...auditMeta(dc.ctx),
      });
    }
    return ok({ statusCode: 204, body: null });
  }

  // ── Restore ───────────────────────────────────────────────────────────────────

  private async handleRestore(
    dc: DispatchContext,
    id: string,
  ): Promise<Result<ApiResponse, AppError>> {
    const r = await dc.repo.restore(id);
    if (r.isErr()) return err(r.error as AppError);

    const row = await dc.repo.findById(id);
    if (row.isErr()) return err(row.error as AppError);

    await this.audit.write({
      eventType: API_AUDIT_EVENTS.ROW_RESTORED,
      actor: toAuditActor(dc.ctx),
      workspaceId: dc.workspaceId,
      resource: { type: `${dc.schema.slug}.${dc.table.name}`, id },
      action: 'restored',
      outcome: 'success',
      correlationId: dc.ctx.correlationId,
      ...auditMeta(dc.ctx),
    });
    return ok({ statusCode: 200, body: row.value });
  }

  // ── Count ─────────────────────────────────────────────────────────────────────

  private async handleCount(dc: DispatchContext): Promise<Result<ApiResponse, AppError>> {
    const filterResult = this.filterParser.parse(dc.queryParams, dc.table);
    if (filterResult.isErr()) return ok(this.validationError(dc.ctx, filterResult.error.message));

    const result = await dc.repo.count(filterResult.value as never);
    if (result.isErr()) return err(result.error as AppError);
    return ok({ statusCode: 200, body: { count: result.value } });
  }

  // ── Bulk Create ───────────────────────────────────────────────────────────────

  private async handleBulkCreate(dc: DispatchContext): Promise<Result<ApiResponse, AppError>> {
    if (!Array.isArray(dc.body))
      return ok(this.validationError(dc.ctx, 'Bulk create requires a JSON array body'));
    if (dc.body.length > 1000)
      return ok(
        this.validationError(
          dc.ctx,
          `Bulk create limit is 1000 rows; got ${String(dc.body.length)}`,
        ),
      );

    const result = await dc.repo.bulkCreate(dc.body as CustomerRow[], { maxRows: 1000 });
    if (result.isErr()) return err(result.error as AppError);

    await this.audit.write({
      eventType: API_AUDIT_EVENTS.BULK_CREATED,
      actor: toAuditActor(dc.ctx),
      workspaceId: dc.workspaceId,
      resource: { type: `${dc.schema.slug}.${dc.table.name}`, id: '*' },
      action: 'bulk_created',
      outcome: 'success',
      correlationId: dc.ctx.correlationId,
      metadata: { count: result.value.length },
      ...auditMeta(dc.ctx),
    });
    return ok({ statusCode: 201, body: result.value });
  }

  // ── Bulk Update ───────────────────────────────────────────────────────────────

  private async handleBulkUpdate(dc: DispatchContext): Promise<Result<ApiResponse, AppError>> {
    if (typeof dc.body !== 'object' || dc.body === null || Array.isArray(dc.body)) {
      return ok(this.validationError(dc.ctx, 'Bulk update requires a JSON object body'));
    }
    const filterResult = this.filterParser.parse(dc.queryParams, dc.table);
    if (filterResult.isErr()) return ok(this.validationError(dc.ctx, filterResult.error.message));
    if (!filterResult.value)
      return ok(this.validationError(dc.ctx, 'Bulk update requires a filter'));

    const rawMax = dc.queryParams['max_affected'];
    const rawMaxStr = Array.isArray(rawMax) ? rawMax[0] : rawMax;
    const maxAffectedRows = rawMaxStr !== undefined ? Number(rawMaxStr) : 10000;

    const result = await dc.repo.bulkUpdate(filterResult.value as never, dc.body as CustomerRow, {
      maxAffectedRows,
    });
    if (result.isErr()) return err(result.error as AppError);

    await this.audit.write({
      eventType: API_AUDIT_EVENTS.BULK_UPDATED,
      actor: toAuditActor(dc.ctx),
      workspaceId: dc.workspaceId,
      resource: { type: `${dc.schema.slug}.${dc.table.name}`, id: '*' },
      action: 'bulk_updated',
      outcome: 'success',
      correlationId: dc.ctx.correlationId,
      metadata: { affectedCount: result.value.affectedCount, changes: Object.keys(dc.body) },
      ...auditMeta(dc.ctx),
    });
    return ok({ statusCode: 200, body: { affectedCount: result.value.affectedCount } });
  }

  // ── Bulk Delete ───────────────────────────────────────────────────────────────

  private async handleBulkDelete(dc: DispatchContext): Promise<Result<ApiResponse, AppError>> {
    const filterResult = this.filterParser.parse(dc.queryParams, dc.table);
    if (filterResult.isErr()) return ok(this.validationError(dc.ctx, filterResult.error.message));
    if (!filterResult.value)
      return ok(this.validationError(dc.ctx, 'Bulk delete requires a filter'));

    const rawMax = dc.queryParams['max_affected'];
    const rawMaxStr = Array.isArray(rawMax) ? rawMax[0] : rawMax;
    const maxAffectedRows = rawMaxStr !== undefined ? Number(rawMaxStr) : 10000;

    const result = await dc.repo.bulkDelete(filterResult.value as never, { maxAffectedRows });
    if (result.isErr()) return err(result.error as AppError);

    await this.audit.write({
      eventType: API_AUDIT_EVENTS.BULK_DELETED,
      actor: toAuditActor(dc.ctx),
      workspaceId: dc.workspaceId,
      resource: { type: `${dc.schema.slug}.${dc.table.name}`, id: '*' },
      action: 'bulk_deleted',
      outcome: 'success',
      correlationId: dc.ctx.correlationId,
      metadata: { affectedCount: result.value.affectedCount },
      ...auditMeta(dc.ctx),
    });
    return ok({ statusCode: 200, body: { affectedCount: result.value.affectedCount } });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  // ── PII redaction ─────────────────────────────────────────────────────────────

  private async shapeRows(
    rows: CustomerRow[],
    dc: DispatchContext,
  ): Promise<{ rows: CustomerRow[]; redacted: string[] }> {
    const piiColumns = dc.table.columns.filter((c) => c.isPii && c.piiCategory);
    if (piiColumns.length === 0) return { rows, redacted: [] };

    // Check pii.read permission once per category (not per row)
    const redactedNames: string[] = [];
    for (const col of piiColumns) {
      const category = col.piiCategory as PiiCategory;
      const authzResult = await this.authz.authorize(dc.ctx, 'pii.read', `pii:${category}`);
      if (authzResult.isErr()) {
        redactedNames.push(col.name);
      }
    }

    if (redactedNames.length === 0) return { rows, redacted: [] };

    const redactedSet = new Set(redactedNames);
    return {
      rows: rows.map((row) => {
        const out = { ...row };
        for (const name of redactedSet) out[name] = null;
        return out;
      }),
      redacted: redactedNames,
    };
  }

  private operationAction(method: HttpMethod, params: ApiRequest['params']): string {
    if (method === 'GET') return 'read';
    if (method === 'POST' && params.subresource === 'restore') return 'update';
    if (method === 'DELETE') return 'delete';
    return 'write';
  }

  private parseFields(queryParams: Record<string, string | string[]>): string[] | null {
    const f = queryParams['fields'];
    if (!f) return null;
    const raw = Array.isArray(f) ? f[0] : f;
    if (!raw) return null;
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private projectFields(row: CustomerRow, fields: string[]): CustomerRow {
    const out: CustomerRow = {};
    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(row, field)) {
        out[field] = row[field];
      }
    }
    return out;
  }

  private parseSort(
    queryParams: Record<string, string | string[]>,
    table: CustomerTableDefinition,
  ): Sort<CustomerRow> | undefined {
    const raw = queryParams['sort'];
    if (!raw) return undefined;
    const str = Array.isArray(raw) ? raw[0] : raw;
    if (!str) return undefined;

    const validCols = new Set(table.columns.map((c) => c.name));
    const sort: Sort<CustomerRow> = {};
    for (const part of str.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('-')) {
        const col = trimmed.slice(1);
        if (validCols.has(col)) sort[col] = 'desc';
      } else {
        if (validCols.has(trimmed)) sort[trimmed] = 'asc';
      }
    }
    return Object.keys(sort).length > 0 ? sort : undefined;
  }

  private resolvePkColumn(table: CustomerTableDefinition): string | null {
    const pk = table.primaryKey;
    if (pk.kind !== 'single') return null;
    const col = table.columns.find((c) => c.id === pk.columnId);
    return col?.name ?? null;
  }

  private validationError(ctx: RequestContext, detail: string): ApiResponse {
    return {
      statusCode: 400,
      body: {
        type: 'https://platform.example.com/errors/validation',
        title: 'Request validation failed',
        status: 400,
        detail,
        correlationId: ctx.correlationId,
      },
      headers: { 'Content-Type': 'application/problem+json' },
    };
  }
}
