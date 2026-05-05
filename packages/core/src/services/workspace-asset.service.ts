import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type {
  AssetCategory,
  AssetTopLevel,
  ConsumedAssetSnapshot,
  ContextualAsset,
  ReplaceAssetInput,
  StageAssetContext,
  StalenessCheck,
  UploadAssetInput,
  WorkspaceAsset,
  WorkspaceAssetPort,
  WorkspaceAssetQuota,
} from '@platform/ports-workspace-assets';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../errors.js';
import { observable } from '../observability/observable.js';

// ── Input schemas ──────────────────────────────────────────────────────────────

const AssetTopLevelSchema = z.enum(['brand', 'documents']);

const BrandCategorySchema = z.enum(['logos', 'colors', 'fonts', 'images', 'icons']);
const DocumentCategorySchema = z.enum(['voice', 'strategy', 'reference', 'compliance', 'specs']);
const AssetCategorySchema = z.union([BrandCategorySchema, DocumentCategorySchema]);

const UploadAssetInputSchema = z.object({
  topLevel: AssetTopLevelSchema,
  category: AssetCategorySchema,
  role: z.string().max(128).optional(),
  filename: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
});

const ReplaceAssetInputSchema = z.object({
  assetId: z.string().min(1),
  filename: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
});

const ListByCategoryInputSchema = z.object({
  topLevel: AssetTopLevelSchema,
  category: AssetCategorySchema,
});

// Service-facing input types (data already includes workspaceId from ctx)
export type UploadWorkspaceAssetInput = z.infer<typeof UploadAssetInputSchema> & {
  data: UploadAssetInput['data'];
};
export type ReplaceWorkspaceAssetInput = z.infer<typeof ReplaceAssetInputSchema> & {
  data: ReplaceAssetInput['data'];
};
export type ListByCategoryInput = z.infer<typeof ListByCategoryInputSchema>;

// ── Service ───────────────────────────────────────────────────────────────────

export class WorkspaceAssetService {
  // ── Public API (observable-wrapped) ─────────────────────────────────────────

  readonly upload!: (
    ctx: RequestContext,
    input: UploadWorkspaceAssetInput,
  ) => Promise<Result<WorkspaceAsset, AppError>>;

  readonly replace!: (
    ctx: RequestContext,
    input: ReplaceWorkspaceAssetInput,
  ) => Promise<Result<WorkspaceAsset, AppError>>;

  readonly delete!: (ctx: RequestContext, assetId: string) => Promise<Result<void, AppError>>;

  readonly listByCategory!: (
    ctx: RequestContext,
    input: ListByCategoryInput,
  ) => Promise<Result<WorkspaceAsset[], AppError>>;

  readonly listByContext!: (
    ctx: RequestContext,
    context: StageAssetContext,
  ) => Promise<Result<ContextualAsset[], AppError>>;

  readonly getQuota!: (ctx: RequestContext) => Promise<Result<WorkspaceAssetQuota, AppError>>;

  readonly getById!: (
    ctx: RequestContext,
    assetId: string,
  ) => Promise<Result<WorkspaceAsset, AppError>>;

  readonly recordConsumedAssets!: (
    ctx: RequestContext,
    generationId: string,
    snapshot: ConsumedAssetSnapshot,
  ) => Promise<Result<void, AppError>>;

  readonly checkStaleness!: (
    ctx: RequestContext,
    snapshot: ConsumedAssetSnapshot,
  ) => Promise<Result<StalenessCheck, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly assets: WorkspaceAssetPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'WorkspaceAssetService';
    this.upload = observable(s, 'upload', obs, this._upload.bind(this));
    this.replace = observable(s, 'replace', obs, this._replace.bind(this));
    this.delete = observable(s, 'delete', obs, this._delete.bind(this));
    this.listByCategory = observable(s, 'listByCategory', obs, this._listByCategory.bind(this));
    this.listByContext = observable(s, 'listByContext', obs, this._listByContext.bind(this));
    this.getQuota = observable(s, 'getQuota', obs, this._getQuota.bind(this));
    this.getById = observable(s, 'getById', obs, this._getById.bind(this));
    this.recordConsumedAssets = observable(
      s,
      'recordConsumedAssets',
      obs,
      this._recordConsumedAssets.bind(this),
    );
    this.checkStaleness = observable(s, 'checkStaleness', obs, this._checkStaleness.bind(this));
  }

  // ── Private implementations ──────────────────────────────────────────────────

  private async _upload(
    ctx: RequestContext,
    input: UploadWorkspaceAssetInput,
  ): Promise<Result<WorkspaceAsset, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = UploadAssetInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid asset upload input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize — workspace admin only
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.upload', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace_asset.uploaded', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Execute
    const uploadInput: UploadAssetInput = {
      workspaceId: ctx.workspaceId,
      topLevel: parsed.data.topLevel,
      category: parsed.data.category,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      data: input.data,
    };
    if (parsed.data.role !== undefined) uploadInput.role = parsed.data.role;
    const uploadResult = await this.assets.upload(uploadInput);
    if (uploadResult.isErr()) {
      const e = uploadResult.error;
      if (e.code === 'ASSET_QUOTA_EXCEEDED') {
        return err(new ConflictError(e.message));
      }
      return err(new ConflictError(e.message));
    }

    const asset = uploadResult.value;

    // 4. Audit
    await this.audit.write({
      eventType: 'workspace_asset.uploaded',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace_asset', id: asset.id },
      action: 'uploaded',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        category: asset.category,
        topLevel: asset.topLevel,
        filename: asset.filename,
        sizeBytes: asset.sizeBytes,
        validationStatus: asset.validationStatus,
      },
      ...auditMeta(ctx),
    });

    this.logger.info('Workspace asset uploaded', {
      workspaceId: ctx.workspaceId,
      assetId: asset.id,
      category: asset.category,
    });

    // 5. Return
    return ok(asset);
  }

  private async _replace(
    ctx: RequestContext,
    input: ReplaceWorkspaceAssetInput,
  ): Promise<Result<WorkspaceAsset, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = ReplaceAssetInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid asset replace input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.upload', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace_asset.replaced', parsed.data.assetId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: asset exists
    const existingResult = await this.assets.findById(ctx.workspaceId, parsed.data.assetId);
    if (existingResult.isErr()) return err(new ConflictError(existingResult.error.message));
    if (!existingResult.value)
      return err(new NotFoundError('workspace_asset', parsed.data.assetId));

    // 4. Execute
    const replaceResult = await this.assets.replace({
      assetId: parsed.data.assetId,
      workspaceId: ctx.workspaceId,
      filename: parsed.data.filename,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
      data: input.data,
    });
    if (replaceResult.isErr()) {
      const e = replaceResult.error;
      if (e.code === 'ASSET_NOT_FOUND')
        return err(new NotFoundError('workspace_asset', parsed.data.assetId));
      return err(new ConflictError(e.message));
    }

    const asset = replaceResult.value;

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace_asset.replaced',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace_asset', id: asset.id },
      action: 'replaced',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        filename: asset.filename,
        newVersion: asset.version,
        sizeBytes: asset.sizeBytes,
      },
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(asset);
  }

  private async _delete(ctx: RequestContext, assetId: string): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    if (!assetId || typeof assetId !== 'string') {
      return err(new ValidationError('assetId is required'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.delete', 'workspace');
    if (authResult.isErr()) {
      await this._logDeny(ctx, 'workspace_asset.deleted', assetId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: asset must exist in this workspace
    const existingResult = await this.assets.findById(ctx.workspaceId, assetId);
    if (existingResult.isErr()) return err(new ConflictError(existingResult.error.message));
    if (!existingResult.value) return err(new NotFoundError('workspace_asset', assetId));

    // 4. Execute
    const deleteResult = await this.assets.delete(ctx.workspaceId, assetId);
    if (deleteResult.isErr()) {
      const e = deleteResult.error;
      if (e.code === 'ASSET_NOT_FOUND') return err(new NotFoundError('workspace_asset', assetId));
      return err(new ConflictError(e.message));
    }

    // 5. Audit
    await this.audit.write({
      eventType: 'workspace_asset.deleted',
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'workspace_asset', id: assetId },
      action: 'deleted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    // 6. Return
    return ok(undefined);
  }

  private async _listByCategory(
    ctx: RequestContext,
    input: ListByCategoryInput,
  ): Promise<Result<WorkspaceAsset[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    const parsed = ListByCategoryInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid list input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize — any workspace member
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.read', 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Execute
    const result = await this.assets.listByCategory(
      ctx.workspaceId,
      parsed.data.topLevel as AssetTopLevel,
      parsed.data.category as AssetCategory,
    );
    if (result.isErr()) return err(new ConflictError(result.error.message));

    // 4. Return
    return ok(result.value);
  }

  private async _listByContext(
    ctx: RequestContext,
    context: StageAssetContext,
  ): Promise<Result<ContextualAsset[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize — pipeline stages run as system context or workspace member
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.read', 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Execute
    const result = await this.assets.listByContext(ctx.workspaceId, context);
    if (result.isErr()) return err(new ConflictError(result.error.message));

    // 3. Return
    return ok(result.value);
  }

  private async _getQuota(ctx: RequestContext): Promise<Result<WorkspaceAssetQuota, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize — any workspace member
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.read', 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 2. Execute
    const result = await this.assets.getQuota(ctx.workspaceId);
    if (result.isErr()) return err(new ConflictError(result.error.message));

    // 3. Return
    return ok(result.value);
  }

  private async _getById(
    ctx: RequestContext,
    assetId: string,
  ): Promise<Result<WorkspaceAsset, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    if (!assetId || typeof assetId !== 'string') {
      return err(new ValidationError('assetId is required'));
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.read', 'workspace');
    if (authResult.isErr()) {
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Execute
    const result = await this.assets.findById(ctx.workspaceId, assetId);
    if (result.isErr()) return err(new ConflictError(result.error.message));
    if (!result.value) return err(new NotFoundError('workspace_asset', assetId));

    // 4. Return
    return ok(result.value);
  }

  private async _recordConsumedAssets(
    ctx: RequestContext,
    generationId: string,
    snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Validate
    if (!generationId || typeof generationId !== 'string') {
      return err(new ValidationError('generationId is required'));
    }

    // 2. Authorize — pipeline stages run as workspace member or system context
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.read', 'workspace');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Execute
    const result = await this.assets.recordConsumedAssets(ctx.workspaceId, generationId, snapshot);
    if (result.isErr()) return err(new ConflictError(result.error.message));

    // 4. Return
    return ok(undefined);
  }

  private async _checkStaleness(
    ctx: RequestContext,
    snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<StalenessCheck, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    // 1. Authorize — any workspace member or pipeline context
    const authResult = await this.authz.authorize(ctx, 'workspace.assets.read', 'workspace');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 2. Execute
    const result = await this.assets.checkStaleness(ctx.workspaceId, snapshot);
    if (result.isErr()) return err(new ConflictError(result.error.message));

    // 3. Return
    return ok(result.value);
  }

  private async _logDeny(
    ctx: RequestContext,
    eventType: string,
    resourceId: string | null,
  ): Promise<void> {
    await this.audit.write({
      eventType,
      ...(ctx.workspaceId != null ? { workspaceId: ctx.workspaceId } : {}),
      actor: toAuditActor(ctx),
      resource: { type: 'workspace_asset', id: resourceId ?? ctx.userId },
      action: eventType.split('.').at(-1) ?? eventType,
      outcome: 'denied',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });
  }
}
