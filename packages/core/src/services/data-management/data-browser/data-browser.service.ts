import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { JobQueuePort } from '@platform/ports-jobs';
import type { LoggerPort } from '@platform/ports-observability';
import type { PaginatedResult, RepositoryPort } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../../../errors.js';
import type {
  CreateViewInput,
  DataBrowserView,
  ExportJob,
  FkLookupRequest,
  FkLookupResult,
  ImportJob,
  ListViewsOptions,
  StartExportInput,
  StartImportInput,
  UpdateViewInput,
} from './types.js';

import { auditMeta, toAuditActor } from '../../../context.js';
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../../../errors.js';
import { observable } from '../../../observability/observable.js';
import { BROWSER_AUDIT_EVENTS } from '../audit-events.js';
import { BROWSER_PERMISSIONS } from './permissions.js';

// ── Zod input schemas ─────────────────────────────────────────────────────────

const ListViewsSchema = z.object({
  workspaceId: z.string().uuid(),
  schemaId: z.string().uuid(),
  tableId: z.string().min(1),
  includeShared: z.boolean().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

const CreateViewSchema = z.object({
  workspaceId: z.string().uuid(),
  schemaId: z.string().uuid(),
  tableId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  filterConfig: z.record(z.unknown()).optional(),
  sortConfig: z
    .array(z.object({ columnId: z.string(), direction: z.enum(['asc', 'desc']) }))
    .optional(),
  visibleColumns: z.array(z.string()).optional(),
  shared: z.boolean().optional(),
});

const UpdateViewSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(1),
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  filterConfig: z.record(z.unknown()).nullable().optional(),
  sortConfig: z
    .array(z.object({ columnId: z.string(), direction: z.enum(['asc', 'desc']) }))
    .nullable()
    .optional(),
  visibleColumns: z.array(z.string()).nullable().optional(),
  shared: z.boolean().optional(),
});

const StartImportSchema = z.object({
  workspaceId: z.string().uuid(),
  schemaId: z.string().uuid(),
  tableId: z.string().min(1),
  sourceFileId: z.string().min(1),
  columnMapping: z.record(z.string()),
  onError: z.enum(['skip', 'fail']).default('skip'),
});

const StartExportSchema = z.object({
  workspaceId: z.string().uuid(),
  schemaId: z.string().uuid(),
  tableId: z.string().min(1),
  filterConfig: z.record(z.unknown()).optional(),
  sortConfig: z
    .array(z.object({ columnId: z.string(), direction: z.enum(['asc', 'desc']) }))
    .optional(),
  format: z.enum(['csv', 'json']).default('csv'),
  scope: z.enum(['filtered', 'all']).default('filtered'),
});

const FkLookupSchema = z.object({
  schemaId: z.string().uuid(),
  requests: z
    .array(
      z.object({
        columnId: z.string().min(1),
        targetTableId: z.string().min(1),
        ids: z.array(z.string()).max(500),
      }),
    )
    .max(20),
});

// ── DataBrowserService ────────────────────────────────────────────────────────

export class DataBrowserService {
  // ── Public API (observable-wrapped) ─────────────────────────────────────────

  readonly listViews!: (
    ctx: RequestContext,
    opts: ListViewsOptions,
  ) => Promise<Result<PaginatedResult<DataBrowserView>, AppError>>;

  readonly getView!: (
    ctx: RequestContext,
    viewId: string,
  ) => Promise<Result<DataBrowserView, AppError>>;

  readonly createView!: (
    ctx: RequestContext,
    input: CreateViewInput,
  ) => Promise<Result<DataBrowserView, AppError>>;

  readonly updateView!: (
    ctx: RequestContext,
    input: UpdateViewInput,
  ) => Promise<Result<DataBrowserView, AppError>>;

  readonly deleteView!: (ctx: RequestContext, viewId: string) => Promise<Result<void, AppError>>;

  readonly startImport!: (
    ctx: RequestContext,
    input: StartImportInput,
  ) => Promise<Result<ImportJob, AppError>>;

  readonly getImportJob!: (
    ctx: RequestContext,
    jobId: string,
  ) => Promise<Result<ImportJob, AppError>>;

  readonly cancelImport!: (ctx: RequestContext, jobId: string) => Promise<Result<void, AppError>>;

  readonly startExport!: (
    ctx: RequestContext,
    input: StartExportInput,
  ) => Promise<Result<ExportJob, AppError>>;

  readonly getExportJob!: (
    ctx: RequestContext,
    jobId: string,
  ) => Promise<Result<ExportJob, AppError>>;

  readonly resolveForeignKeys!: (
    ctx: RequestContext,
    schemaId: string,
    requests: FkLookupRequest[],
  ) => Promise<Result<FkLookupResult[], AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly views: RepositoryPort<DataBrowserView>,
    private readonly importJobs: RepositoryPort<ImportJob>,
    private readonly exportJobs: RepositoryPort<ExportJob>,
    private readonly jobQueue: JobQueuePort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const s = 'DataBrowserService';
    const obs = { logger };
    this.listViews = observable(s, 'listViews', obs, this._listViews.bind(this));
    this.getView = observable(s, 'getView', obs, this._getView.bind(this));
    this.createView = observable(s, 'createView', obs, this._createView.bind(this));
    this.updateView = observable(s, 'updateView', obs, this._updateView.bind(this));
    this.deleteView = observable(s, 'deleteView', obs, this._deleteView.bind(this));
    this.startImport = observable(s, 'startImport', obs, this._startImport.bind(this));
    this.getImportJob = observable(s, 'getImportJob', obs, this._getImportJob.bind(this));
    this.cancelImport = observable(s, 'cancelImport', obs, this._cancelImport.bind(this));
    this.startExport = observable(s, 'startExport', obs, this._startExport.bind(this));
    this.getExportJob = observable(s, 'getExportJob', obs, this._getExportJob.bind(this));
    this.resolveForeignKeys = observable(
      s,
      'resolveForeignKeys',
      obs,
      this._resolveForeignKeys.bind(this),
    );
  }

  // ── Private: Saved Views ─────────────────────────────────────────────────────

  private async _listViews(
    ctx: RequestContext,
    opts: ListViewsOptions,
  ): Promise<Result<PaginatedResult<DataBrowserView>, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const parsed = ListViewsSchema.safeParse(opts);
    if (!parsed.success) return err(new ValidationError(parsed.error.message));

    const authResult = await this.authz.authorize(ctx, BROWSER_PERMISSIONS.READ, 'data_browser');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const filter: Record<string, unknown> = {
      workspaceId: { _eq: ctx.workspaceId },
      schemaId: { _eq: parsed.data.schemaId },
      tableId: { _eq: parsed.data.tableId },
    };

    if (parsed.data.includeShared) {
      filter['_or'] = [{ createdByUserId: { _eq: ctx.userId } }, { shared: { _eq: true } }];
    } else {
      filter['createdByUserId'] = { _eq: ctx.userId };
    }

    const result = await this.views.findMany({
      filter: filter as never,
      sort: { createdAt: 'asc' } as never,
      page: { limit: parsed.data.limit, offset: parsed.data.offset },
    });

    if (result.isErr()) return err(new InternalError(result.error.message));
    return ok(result.value);
  }

  private async _getView(
    ctx: RequestContext,
    viewId: string,
  ): Promise<Result<DataBrowserView, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, BROWSER_PERMISSIONS.READ, 'data_browser');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.views.findById(viewId);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value || result.value.deletedAt !== null) {
      return err(new NotFoundError('data_browser_view', viewId));
    }

    const view = result.value;
    if (view.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('View belongs to a different workspace'));
    }
    if (!view.shared && view.createdByUserId !== ctx.userId) {
      return err(new ForbiddenError('View is not shared and belongs to another user'));
    }

    return ok(view);
  }

  private async _createView(
    ctx: RequestContext,
    input: CreateViewInput,
  ): Promise<Result<DataBrowserView, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const parsed = CreateViewSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError(parsed.error.message));

    const authResult = await this.authz.authorize(
      ctx,
      BROWSER_PERMISSIONS.MANAGE_VIEWS,
      'data_browser',
    );
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const now = new Date();
    const view: DataBrowserView = {
      id: uuidv7(),
      version: 1,
      workspaceId: ctx.workspaceId,
      schemaId: parsed.data.schemaId,
      tableId: parsed.data.tableId,
      createdByUserId: ctx.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      filterConfig: parsed.data.filterConfig ?? null,
      sortConfig: parsed.data.sortConfig ?? null,
      visibleColumns: parsed.data.visibleColumns ?? null,
      shared: parsed.data.shared ?? false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const saveResult = await this.views.create(view);
    if (saveResult.isErr()) {
      if (saveResult.error.message.includes('unique')) {
        return err(new ConflictError(`A view named "${view.name}" already exists for this table`));
      }
      return err(new InternalError(saveResult.error.message));
    }

    await this.audit.write({
      eventType: BROWSER_AUDIT_EVENTS.VIEW_CREATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      action: 'view_created',
      outcome: 'success',
      resource: { type: 'data_browser_view', id: view.id },
      metadata: { schemaId: view.schemaId, tableId: view.tableId, name: view.name },
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(view);
  }

  private async _updateView(
    ctx: RequestContext,
    input: UpdateViewInput,
  ): Promise<Result<DataBrowserView, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const parsed = UpdateViewSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError(parsed.error.message));

    const authResult = await this.authz.authorize(
      ctx,
      BROWSER_PERMISSIONS.MANAGE_VIEWS,
      'data_browser',
    );
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const existingResult = await this._getView(ctx, parsed.data.id);
    if (existingResult.isErr()) return existingResult;
    const existing = existingResult.value;

    if (existing.createdByUserId !== ctx.userId) {
      return err(new ForbiddenError('Only the view creator can update it'));
    }
    if (existing.version !== parsed.data.version) {
      return err(new ConflictError('View was modified by another operation; refresh and retry'));
    }

    const wasShared = !existing.shared && parsed.data.shared === true;

    const changes: Partial<Omit<DataBrowserView, 'id'>> = {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description }),
      ...(parsed.data.filterConfig !== undefined && { filterConfig: parsed.data.filterConfig }),
      ...(parsed.data.sortConfig !== undefined && { sortConfig: parsed.data.sortConfig }),
      ...(parsed.data.visibleColumns !== undefined && {
        visibleColumns: parsed.data.visibleColumns,
      }),
      ...(parsed.data.shared !== undefined && { shared: parsed.data.shared }),
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    };

    const updateResult = await this.views.update(parsed.data.id, changes, {
      expectedVersion: parsed.data.version,
    });
    if (updateResult.isErr()) {
      if (
        updateResult.error.message.includes('conflict') ||
        updateResult.error.message.includes('version')
      ) {
        return err(new ConflictError('View was modified concurrently'));
      }
      return err(new InternalError(updateResult.error.message));
    }

    const eventType = wasShared
      ? BROWSER_AUDIT_EVENTS.VIEW_SHARED
      : BROWSER_AUDIT_EVENTS.VIEW_UPDATED;
    await this.audit.write({
      eventType,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      action: wasShared ? 'view_shared' : 'view_updated',
      outcome: 'success',
      resource: { type: 'data_browser_view', id: parsed.data.id },
      metadata: { name: updateResult.value.name, shared: updateResult.value.shared },
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(updateResult.value);
  }

  private async _deleteView(ctx: RequestContext, viewId: string): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(
      ctx,
      BROWSER_PERMISSIONS.MANAGE_VIEWS,
      'data_browser',
    );
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const existingResult = await this._getView(ctx, viewId);
    if (existingResult.isErr()) return err(existingResult.error);
    const existing = existingResult.value;

    if (existing.createdByUserId !== ctx.userId) {
      return err(new ForbiddenError('Only the view creator can delete it'));
    }

    const archiveResult = await this.views.archive(viewId);
    if (archiveResult.isErr()) return err(new InternalError(archiveResult.error.message));

    await this.audit.write({
      eventType: BROWSER_AUDIT_EVENTS.VIEW_DELETED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      action: 'view_deleted',
      outcome: 'success',
      resource: { type: 'data_browser_view', id: viewId },
      metadata: { name: existing.name },
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  // ── Private: Import ───────────────────────────────────────────────────────────

  private async _startImport(
    ctx: RequestContext,
    input: StartImportInput,
  ): Promise<Result<ImportJob, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const parsed = StartImportSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError(parsed.error.message));

    const authResult = await this.authz.authorize(ctx, BROWSER_PERMISSIONS.IMPORT, 'data_browser');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const now = new Date();
    const job: ImportJob = {
      id: uuidv7(),
      version: 1,
      workspaceId: ctx.workspaceId,
      schemaId: parsed.data.schemaId,
      tableId: parsed.data.tableId,
      initiatedByUserId: ctx.userId,
      sourceFileId: parsed.data.sourceFileId,
      columnMapping: parsed.data.columnMapping,
      onError: parsed.data.onError,
      status: 'pending',
      totalRows: null,
      importedRows: 0,
      skippedRows: 0,
      errorFileId: null,
      errorSummary: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const saveResult = await this.importJobs.create(job);
    if (saveResult.isErr()) return err(new InternalError(saveResult.error.message));

    const enqueueResult = await this.jobQueue.enqueue('data_browser', 'import', {
      jobId: job.id,
      workspaceId: ctx.workspaceId,
    });
    if (enqueueResult.isErr()) {
      this.logger.warn('Failed to enqueue import job', { jobId: job.id });
    }

    await this.audit.write({
      eventType: BROWSER_AUDIT_EVENTS.IMPORT_STARTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      action: 'import_started',
      outcome: 'success',
      resource: { type: 'import_job', id: job.id },
      metadata: { schemaId: job.schemaId, tableId: job.tableId, sourceFileId: job.sourceFileId },
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(job);
  }

  private async _getImportJob(
    ctx: RequestContext,
    jobId: string,
  ): Promise<Result<ImportJob, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, BROWSER_PERMISSIONS.IMPORT, 'data_browser');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.importJobs.findById(jobId);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value || result.value.deletedAt !== null) {
      return err(new NotFoundError('import_job', jobId));
    }
    if (result.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Job belongs to a different workspace'));
    }

    return ok(result.value);
  }

  private async _cancelImport(ctx: RequestContext, jobId: string): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const existingResult = await this._getImportJob(ctx, jobId);
    if (existingResult.isErr()) return err(existingResult.error);
    const existing = existingResult.value;

    const cancellable: Array<ImportJob['status']> = ['pending', 'validating', 'importing'];
    if (!cancellable.includes(existing.status)) {
      return err(new ConflictError(`Cannot cancel a job with status "${existing.status}"`));
    }

    const updateResult = await this.importJobs.update(jobId, {
      status: 'cancelled',
      completedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: ctx.userId,
    });
    if (updateResult.isErr()) return err(new InternalError(updateResult.error.message));

    await this.audit.write({
      eventType: BROWSER_AUDIT_EVENTS.IMPORT_CANCELLED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      action: 'import_cancelled',
      outcome: 'success',
      resource: { type: 'import_job', id: jobId },
      metadata: {},
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  // ── Private: Export ───────────────────────────────────────────────────────────

  private async _startExport(
    ctx: RequestContext,
    input: StartExportInput,
  ): Promise<Result<ExportJob, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const parsed = StartExportSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError(parsed.error.message));

    const authResult = await this.authz.authorize(ctx, BROWSER_PERMISSIONS.EXPORT, 'data_browser');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const now = new Date();
    const job: ExportJob = {
      id: uuidv7(),
      version: 1,
      workspaceId: ctx.workspaceId,
      schemaId: parsed.data.schemaId,
      tableId: parsed.data.tableId,
      initiatedByUserId: ctx.userId,
      filterConfig: parsed.data.filterConfig ?? null,
      sortConfig: parsed.data.sortConfig ?? null,
      format: parsed.data.format,
      scope: parsed.data.scope,
      status: 'pending',
      totalRows: null,
      exportedRows: 0,
      outputFileId: null,
      signedUrl: null,
      signedUrlExpiresAt: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    const saveResult = await this.exportJobs.create(job);
    if (saveResult.isErr()) return err(new InternalError(saveResult.error.message));

    const enqueueResult = await this.jobQueue.enqueue('data_browser', 'export', {
      jobId: job.id,
      workspaceId: ctx.workspaceId,
    });
    if (enqueueResult.isErr()) {
      this.logger.warn('Failed to enqueue export job', { jobId: job.id });
    }

    await this.audit.write({
      eventType: BROWSER_AUDIT_EVENTS.EXPORT_STARTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      action: 'export_started',
      outcome: 'success',
      resource: { type: 'export_job', id: job.id },
      metadata: {
        schemaId: job.schemaId,
        tableId: job.tableId,
        format: job.format,
        scope: job.scope,
      },
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(job);
  }

  private async _getExportJob(
    ctx: RequestContext,
    jobId: string,
  ): Promise<Result<ExportJob, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, BROWSER_PERMISSIONS.EXPORT, 'data_browser');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.exportJobs.findById(jobId);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value || result.value.deletedAt !== null) {
      return err(new NotFoundError('export_job', jobId));
    }
    if (result.value.workspaceId !== ctx.workspaceId) {
      return err(new ForbiddenError('Job belongs to a different workspace'));
    }

    return ok(result.value);
  }

  // ── Private: FK batched lookup ────────────────────────────────────────────────

  private async _resolveForeignKeys(
    ctx: RequestContext,
    schemaId: string,
    requests: FkLookupRequest[],
  ): Promise<Result<FkLookupResult[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const parsed = FkLookupSchema.safeParse({ schemaId, requests });
    if (!parsed.success) return err(new ValidationError(parsed.error.message));

    const authResult = await this.authz.authorize(ctx, BROWSER_PERMISSIONS.READ, 'data_browser');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // FK resolution is delegated to the REST API layer (Objective 12).
    // Return empty resolved maps; cells fall back to raw IDs until the API layer wires this up.
    const results: FkLookupResult[] = parsed.data.requests.map((req) => ({
      columnId: req.columnId,
      targetTableId: req.targetTableId,
      resolved: {},
    }));

    return ok(results);
  }
}
