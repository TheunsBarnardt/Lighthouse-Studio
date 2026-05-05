import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { EventBusPort } from '@platform/ports-eventing';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';
import type {
  Bucket,
  BucketUpdate,
  BulkOperationResult,
  CreateBucketInput,
  FileAcl,
  FileLocation,
  FileRecord,
  ListFilesOptions,
  ObjectStoragePort,
  SignedUrlOptions,
  SignedUrlRecord,
  StoragePaginatedResult,
  StorageQuota,
  UploadFileInput,
} from '@platform/ports-storage';
import type { Readable } from 'node:stream';

import { err, ok, type Result } from 'neverthrow';
import { createHash, randomBytes } from 'node:crypto';
import { uuidv7 } from 'uuidv7';

import type { AppError } from '../../../errors.js';

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
import { STORAGE_AUDIT_EVENTS } from './audit-events.js';
import {
  BucketUpdateSchema,
  CreateBucketInputSchema,
  DEFAULT_QUOTA_BYTES,
  DEFAULT_SIGNED_URL_TTL_SECONDS,
  FileAclInputSchema,
  FileLocationSchema,
  KEEP_FILE_PLACEHOLDER,
  ListFilesOptionsSchema,
  QUOTA_WARNING_80_THRESHOLD,
  QUOTA_WARNING_95_THRESHOLD,
  SetMetadataInputSchema,
  SetTagsInputSchema,
  SignedUrlOptionsSchema,
  THUMBNAIL_PREFIX,
  UploadFileInputSchema,
} from './storage-model.js';

// ── Error ──────────────────────────────────────────────────────────────────────

export class StorageQuotaExceededError extends Error {
  readonly code = 'STORAGE_QUOTA_EXCEEDED' as const;
  readonly statusCode = 429;
  constructor(
    public readonly workspaceId: string,
    public readonly usedBytes: number,
    public readonly quotaBytes: number,
  ) {
    super(
      `Storage quota exceeded for workspace ${workspaceId}: ${String(usedBytes)} / ${String(quotaBytes)} bytes used`,
    );
    this.name = 'StorageQuotaExceededError';
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type BucketRepo = RepositoryPort<Bucket>;
type FileRecordRepo = RepositoryPort<FileRecord>;
type FileAclRepo = RepositoryPort<FileAcl>;
type SignedUrlRepo = RepositoryPort<SignedUrlRecord>;
type QuotaRepo = RepositoryPort<StorageQuota>;

export interface StorageRealtimeEvent {
  type: 'file.created' | 'file.updated' | 'file.deleted' | 'file.moved' | 'bucket.changed';
  workspaceId: string;
  bucketId?: string;
  fileId?: string;
  payload: unknown;
}

// ── StorageService ─────────────────────────────────────────────────────────────

export class StorageService {
  // ── Public API (observable-wrapped) ─────────────────────────────────────────

  readonly listBuckets!: (ctx: RequestContext) => Promise<Result<Bucket[], AppError>>;

  readonly createBucket!: (
    ctx: RequestContext,
    input: CreateBucketInput,
  ) => Promise<Result<Bucket, AppError>>;

  readonly getBucket!: (ctx: RequestContext, bucketId: string) => Promise<Result<Bucket, AppError>>;

  readonly updateBucket!: (
    ctx: RequestContext,
    bucketId: string,
    changes: BucketUpdate,
  ) => Promise<Result<Bucket, AppError>>;

  readonly deleteBucket!: (
    ctx: RequestContext,
    bucketId: string,
  ) => Promise<Result<void, AppError>>;

  readonly listFiles!: (
    ctx: RequestContext,
    opts: ListFilesOptions,
  ) => Promise<Result<StoragePaginatedResult<FileRecord>, AppError>>;

  readonly getFile!: (ctx: RequestContext, fileId: string) => Promise<Result<FileRecord, AppError>>;

  readonly uploadFile!: (
    ctx: RequestContext,
    input: UploadFileInput,
    data: Buffer | Readable,
  ) => Promise<Result<FileRecord, AppError>>;

  readonly copyFile!: (
    ctx: RequestContext,
    fileId: string,
    destination: FileLocation,
  ) => Promise<Result<FileRecord, AppError>>;

  readonly moveFile!: (
    ctx: RequestContext,
    fileId: string,
    destination: FileLocation,
  ) => Promise<Result<FileRecord, AppError>>;

  readonly renameFile!: (
    ctx: RequestContext,
    fileId: string,
    newName: string,
  ) => Promise<Result<FileRecord, AppError>>;

  readonly deleteFile!: (ctx: RequestContext, fileId: string) => Promise<Result<void, AppError>>;

  readonly bulkDelete!: (
    ctx: RequestContext,
    fileIds: string[],
  ) => Promise<Result<BulkOperationResult, AppError>>;

  readonly bulkMove!: (
    ctx: RequestContext,
    fileIds: string[],
    destination: FileLocation,
  ) => Promise<Result<BulkOperationResult, AppError>>;

  readonly createFolder!: (
    ctx: RequestContext,
    bucketId: string,
    path: string,
  ) => Promise<Result<void, AppError>>;

  readonly deleteFolder!: (
    ctx: RequestContext,
    bucketId: string,
    path: string,
  ) => Promise<Result<BulkOperationResult, AppError>>;

  readonly moveFolder!: (
    ctx: RequestContext,
    bucketId: string,
    fromPath: string,
    toPath: string,
  ) => Promise<Result<BulkOperationResult, AppError>>;

  readonly createSignedUrl!: (
    ctx: RequestContext,
    fileId: string,
    opts: SignedUrlOptions,
  ) => Promise<Result<SignedUrlRecord, AppError>>;

  readonly revokeSignedUrl!: (
    ctx: RequestContext,
    signedUrlId: string,
  ) => Promise<Result<void, AppError>>;

  readonly resolveSignedUrl!: (
    token: string,
  ) => Promise<Result<{ fileId: string; storageUrl: string; cachePublic: boolean }, AppError>>;

  readonly setTags!: (
    ctx: RequestContext,
    fileId: string,
    tags: string[],
  ) => Promise<Result<FileRecord, AppError>>;

  readonly setMetadata!: (
    ctx: RequestContext,
    fileId: string,
    metadata: Record<string, unknown>,
  ) => Promise<Result<FileRecord, AppError>>;

  readonly setFileAcl!: (
    ctx: RequestContext,
    fileId: string,
    acl: Record<string, string[]>,
  ) => Promise<Result<void, AppError>>;

  readonly removeFileAcl!: (ctx: RequestContext, fileId: string) => Promise<Result<void, AppError>>;

  readonly getQuota!: (ctx: RequestContext) => Promise<Result<StorageQuota, AppError>>;

  readonly downloadFile!: (
    ctx: RequestContext,
    fileId: string,
  ) => Promise<Result<{ stream: Readable; contentType: string; filename: string }, AppError>>;

  /**
   * Returns a signed URL to a thumbnail, generating it on first access.
   * The `transform` function receives the original file stream and returns
   * the thumbnail bytes — keeping sharp (or any image lib) out of core.
   */
  readonly getOrGenerateThumbnailUrl!: (
    ctx: RequestContext,
    fileId: string,
    size: 'small' | 'medium' | 'large',
    transform: (stream: Readable, contentType: string) => Promise<Buffer>,
  ) => Promise<Result<string, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly storage: ObjectStoragePort,
    private readonly buckets: BucketRepo,
    private readonly fileRecords: FileRecordRepo,
    private readonly fileAcls: FileAclRepo,
    private readonly signedUrls: SignedUrlRepo,
    private readonly quotas: QuotaRepo,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly events?: EventBusPort,
    private readonly metrics?: MetricsPort,
  ) {
    const obs = { logger, ...(metrics !== undefined ? { metrics } : {}) };
    const s = 'StorageService';
    this.listBuckets = observable(s, 'listBuckets', obs, this._listBuckets.bind(this));
    this.createBucket = observable(s, 'createBucket', obs, this._createBucket.bind(this));
    this.getBucket = observable(s, 'getBucket', obs, this._getBucket.bind(this));
    this.updateBucket = observable(s, 'updateBucket', obs, this._updateBucket.bind(this));
    this.deleteBucket = observable(s, 'deleteBucket', obs, this._deleteBucket.bind(this));
    this.listFiles = observable(s, 'listFiles', obs, this._listFiles.bind(this));
    this.getFile = observable(s, 'getFile', obs, this._getFile.bind(this));
    this.uploadFile = observable(s, 'uploadFile', obs, this._uploadFile.bind(this));
    this.copyFile = observable(s, 'copyFile', obs, this._copyFile.bind(this));
    this.moveFile = observable(s, 'moveFile', obs, this._moveFile.bind(this));
    this.renameFile = observable(s, 'renameFile', obs, this._renameFile.bind(this));
    this.deleteFile = observable(s, 'deleteFile', obs, this._deleteFile.bind(this));
    this.bulkDelete = observable(s, 'bulkDelete', obs, this._bulkDelete.bind(this));
    this.bulkMove = observable(s, 'bulkMove', obs, this._bulkMove.bind(this));
    this.createFolder = observable(s, 'createFolder', obs, this._createFolder.bind(this));
    this.deleteFolder = observable(s, 'deleteFolder', obs, this._deleteFolder.bind(this));
    this.moveFolder = observable(s, 'moveFolder', obs, this._moveFolder.bind(this));
    this.createSignedUrl = observable(s, 'createSignedUrl', obs, this._createSignedUrl.bind(this));
    this.revokeSignedUrl = observable(s, 'revokeSignedUrl', obs, this._revokeSignedUrl.bind(this));
    // resolveSignedUrl takes a token, not a RequestContext, so cannot use observable()
    this.resolveSignedUrl = this._resolveSignedUrl.bind(this);
    this.setTags = observable(s, 'setTags', obs, this._setTags.bind(this));
    this.setMetadata = observable(s, 'setMetadata', obs, this._setMetadata.bind(this));
    this.setFileAcl = observable(s, 'setFileAcl', obs, this._setFileAcl.bind(this));
    this.removeFileAcl = observable(s, 'removeFileAcl', obs, this._removeFileAcl.bind(this));
    this.getQuota = observable(s, 'getQuota', obs, this._getQuota.bind(this));
    this.downloadFile = observable(s, 'downloadFile', obs, this._downloadFile.bind(this));
    this.getOrGenerateThumbnailUrl = observable(
      s,
      'getOrGenerateThumbnailUrl',
      obs,
      this._getOrGenerateThumbnailUrl.bind(this),
    );
  }

  // ── Private implementations ──────────────────────────────────────────────────

  private async _listBuckets(ctx: RequestContext): Promise<Result<Bucket[], AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_bucket.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.buckets.findMany({
      filter: { workspaceId: { _eq: ctx.workspaceId } },
    } as Parameters<BucketRepo['findMany']>[0]);
    if (result.isErr()) return err(new InternalError(result.error.message));

    return ok(result.value.items);
  }

  private async _createBucket(
    ctx: RequestContext,
    input: CreateBucketInput,
  ): Promise<Result<Bucket, AppError>> {
    // 1. Validate
    const parsed = CreateBucketInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid bucket input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    const wid = ctx.workspaceId;

    const authResult = await this.authz.authorize(ctx, 'storage_bucket.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Precondition: slug uniqueness
    const existing = await this.buckets.findOne({
      workspaceId: { _eq: wid },
      slug: { _eq: parsed.data.slug },
    } as Parameters<BucketRepo['findOne']>[0]);
    if (existing.isErr()) return err(new InternalError(existing.error.message));
    if (existing.value) {
      return err(
        new ConflictError(`Bucket slug '${parsed.data.slug}' already exists in this workspace`),
      );
    }

    // 4. Execute
    const now = new Date();
    const bucket: Bucket = {
      id: uuidv7(),
      workspaceId: wid,
      name: parsed.data.name,
      slug: parsed.data.slug,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      defaultRoleGrants: parsed.data.defaultRoleGrants ?? {},
      defaultPiiFlag: parsed.data.defaultPiiFlag ?? false,
      storageClass: parsed.data.storageClass ?? 'standard',
      metadata: parsed.data.metadata ?? {},
      createdAt: now,
      updatedAt: now,
      createdBy: ctx.userId,
    };

    const createResult = await this.buckets.create(bucket);
    if (createResult.isErr()) return err(new InternalError(createResult.error.message));

    // Ensure quota record exists for this workspace
    await this._ensureQuota(wid);

    // 5. Audit
    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.BUCKET_CREATED,
      workspaceId: wid,
      actor: toAuditActor(ctx),
      resource: { type: 'storage_bucket', id: bucket.id },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { slug: bucket.slug },
      ...auditMeta(ctx),
    });

    await this._emitStorageEvent('bucket.changed', wid, { bucketId: bucket.id, action: 'created' });
    return ok(bucket);
  }

  private async _getBucket(
    ctx: RequestContext,
    bucketId: string,
  ): Promise<Result<Bucket, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_bucket.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.buckets.findOne({
      id: { _eq: bucketId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<BucketRepo['findOne']>[0]);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value) return err(new NotFoundError('storage_bucket', bucketId));

    return ok(result.value);
  }

  private async _updateBucket(
    ctx: RequestContext,
    bucketId: string,
    changes: BucketUpdate,
  ): Promise<Result<Bucket, AppError>> {
    // 1. Validate
    const parsed = BucketUpdateSchema.safeParse(changes);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid bucket update',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_bucket.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Precondition: bucket must exist in this workspace
    const existing = await this.buckets.findOne({
      id: { _eq: bucketId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<BucketRepo['findOne']>[0]);
    if (existing.isErr()) return err(new InternalError(existing.error.message));
    if (!existing.value) return err(new NotFoundError('storage_bucket', bucketId));

    // 4. Execute
    const updated: Bucket = {
      ...existing.value,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.defaultRoleGrants !== undefined
        ? { defaultRoleGrants: parsed.data.defaultRoleGrants }
        : {}),
      ...(parsed.data.defaultPiiFlag !== undefined
        ? { defaultPiiFlag: parsed.data.defaultPiiFlag }
        : {}),
      ...(parsed.data.storageClass !== undefined ? { storageClass: parsed.data.storageClass } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
      updatedAt: new Date(),
    };

    const updateResult = await this.buckets.update(bucketId, updated);
    if (updateResult.isErr()) return err(new InternalError(updateResult.error.message));

    // 5. Audit
    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.BUCKET_UPDATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'storage_bucket', id: bucketId },
      action: 'updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { changes: Object.keys(parsed.data) },
      ...auditMeta(ctx),
    });

    await this._emitStorageEvent('bucket.changed', ctx.workspaceId, {
      bucketId,
      action: 'updated',
    });
    return ok(updated);
  }

  private async _deleteBucket(
    ctx: RequestContext,
    bucketId: string,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_bucket.delete', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const existing = await this.buckets.findOne({
      id: { _eq: bucketId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<BucketRepo['findOne']>[0]);
    if (existing.isErr()) return err(new InternalError(existing.error.message));
    if (!existing.value) return err(new NotFoundError('storage_bucket', bucketId));

    // Precondition: bucket must be empty
    const filesResult = await this.fileRecords.findMany({
      filter: {
        bucketId: { _eq: bucketId },
        status: { _neq: 'deleted' },
      },
      page: { limit: 1, offset: 0 },
    } as Parameters<FileRecordRepo['findMany']>[0]);
    if (filesResult.isErr()) return err(new InternalError(filesResult.error.message));
    if (filesResult.value.items.length > 0) {
      return err(new ConflictError('Cannot delete a bucket that still contains files'));
    }

    const deleteResult = await this.buckets.archive(bucketId);
    if (deleteResult.isErr()) return err(new InternalError(deleteResult.error.message));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.BUCKET_DELETED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'storage_bucket', id: bucketId },
      action: 'deleted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    await this._emitStorageEvent('bucket.changed', ctx.workspaceId, {
      bucketId,
      action: 'deleted',
    });
    return ok(undefined);
  }

  private async _listFiles(
    ctx: RequestContext,
    opts: ListFilesOptions,
  ): Promise<Result<StoragePaginatedResult<FileRecord>, AppError>> {
    // 1. Validate
    const parsed = ListFilesOptionsSchema.safeParse(opts);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid list options',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Execute
    const filter: Record<string, unknown> = { workspaceId: { _eq: ctx.workspaceId } };
    if (parsed.data.bucketId) filter['bucketId'] = { _eq: parsed.data.bucketId };
    if (parsed.data.folderPath !== undefined)
      filter['folderPath'] = { _eq: parsed.data.folderPath };
    if (parsed.data.status) filter['status'] = { _eq: parsed.data.status };
    else filter['status'] = { _neq: 'deleted' };

    const result = await this.fileRecords.findMany({
      filter,
      page: { limit: parsed.data.limit ?? 50, offset: parsed.data.offset ?? 0 },
    } as Parameters<FileRecordRepo['findMany']>[0]);
    if (result.isErr()) return err(new InternalError(result.error.message));

    return ok({
      items: result.value.items,
      total: result.value.total,
      limit: parsed.data.limit ?? 50,
      offset: parsed.data.offset ?? 0,
    });
  }

  private async _getFile(
    ctx: RequestContext,
    fileId: string,
  ): Promise<Result<FileRecord, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value) return err(new NotFoundError('file_record', fileId));

    // Check file-level ACL override
    const effective = await this._checkFileAcl(ctx, result.value, 'read');
    if (!effective) return err(new ForbiddenError('Access denied by file ACL'));

    return ok(result.value);
  }

  private async _uploadFile(
    ctx: RequestContext,
    input: UploadFileInput,
    data: Buffer | Readable,
  ): Promise<Result<FileRecord, AppError>> {
    // 1. Validate
    const parsed = UploadFileInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid upload input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    const wid = ctx.workspaceId;

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Preconditions: quota check
    const quotaResult = await this._enforceQuota(wid, parsed.data.sizeBytes);
    if (quotaResult.isErr()) return err(quotaResult.error);

    // Bucket must exist in workspace
    const bucketResult = await this.buckets.findOne({
      id: { _eq: parsed.data.bucketId },
      workspaceId: { _eq: wid },
    } as Parameters<BucketRepo['findOne']>[0]);
    if (bucketResult.isErr()) return err(new InternalError(bucketResult.error.message));
    if (!bucketResult.value) return err(new NotFoundError('storage_bucket', parsed.data.bucketId));

    // 4. Execute: write to storage adapter
    const folderPath = parsed.data.folderPath ?? '';
    const storageKey = this._buildStorageKey(
      wid,
      parsed.data.bucketId,
      folderPath,
      parsed.data.filename,
    );

    const putResult = await this.storage.put(storageKey, data, {
      ...(parsed.data.contentType !== undefined ? { contentType: parsed.data.contentType } : {}),
    });
    if (putResult.isErr()) {
      return err(new InternalError(`Storage put failed: ${putResult.error.message}`));
    }

    // Write DB record
    const now = new Date();
    const fileRecord: FileRecord = {
      id: uuidv7(),
      workspaceId: wid,
      bucketId: parsed.data.bucketId,
      storageKey,
      filename: parsed.data.filename,
      folderPath,
      sizeBytes: parsed.data.sizeBytes,
      ...(parsed.data.contentType !== undefined ? { contentType: parsed.data.contentType } : {}),
      ...(putResult.value.etag !== undefined ? { etag: putResult.value.etag } : {}),
      uploaderUserId: ctx.userId,
      tags: parsed.data.tags ?? [],
      customMetadata: parsed.data.customMetadata ?? {},
      piiFlag: parsed.data.piiFlag ?? bucketResult.value.defaultPiiFlag,
      piiCategories: parsed.data.piiCategories ?? [],
      status: 'available',
      createdAt: now,
      updatedAt: now,
    };

    const createResult = await this.fileRecords.create(fileRecord);
    if (createResult.isErr()) {
      // Storage write succeeded but DB write failed — log orphan warning
      this.logger.warn('Storage orphan: object written but DB record failed', {
        storageKey,
        workspaceId: wid,
        error: createResult.error,
      });
      return err(new InternalError(createResult.error.message));
    }

    // Update quota
    await this._incrementQuota(wid, parsed.data.sizeBytes);

    // Emit quota warnings if needed
    await this._checkQuotaWarnings(wid);

    // 5. Audit
    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FILE_UPLOADED,
      workspaceId: wid,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileRecord.id },
      action: 'uploaded',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        filename: fileRecord.filename,
        sizeBytes: fileRecord.sizeBytes,
        bucketId: fileRecord.bucketId,
        piiFlag: fileRecord.piiFlag,
      },
      ...auditMeta(ctx),
    });

    await this._emitStorageEvent('file.created', wid, {
      fileId: fileRecord.id,
      bucketId: fileRecord.bucketId,
      filename: fileRecord.filename,
      folderPath: fileRecord.folderPath,
    });

    this.metrics
      ?.counter('platform_storage_uploads_total', { description: 'Number of files uploaded' })
      .add(1, { workspace: wid, status: 'success' });

    return ok(fileRecord);
  }

  private async _copyFile(
    ctx: RequestContext,
    fileId: string,
    destination: FileLocation,
  ): Promise<Result<FileRecord, AppError>> {
    // 1. Validate
    const parsedDest = FileLocationSchema.safeParse(destination);
    if (!parsedDest.success) {
      return err(
        new ValidationError(
          'Invalid destination',
          parsedDest.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Get source file
    const sourceResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (sourceResult.isErr()) return err(new InternalError(sourceResult.error.message));
    if (!sourceResult.value) return err(new NotFoundError('file_record', fileId));
    const source = sourceResult.value;

    // 4. Execute: stream source, write to dest
    const getResult = await this.storage.get(source.storageKey);
    if (getResult.isErr()) {
      return err(new InternalError(`Failed to read source file: ${getResult.error.message}`));
    }

    const newFilename = parsedDest.data.filename ?? source.filename;
    const destKey = this._buildStorageKey(
      ctx.workspaceId,
      parsedDest.data.bucketId,
      parsedDest.data.folderPath,
      newFilename,
    );

    const chunks: Buffer[] = [];
    for await (const chunk of getResult.value as AsyncIterable<Buffer | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buf = Buffer.concat(chunks);

    const putResult = await this.storage.put(destKey, buf, {
      ...(source.contentType !== undefined ? { contentType: source.contentType } : {}),
    });
    if (putResult.isErr()) {
      return err(new InternalError(`Copy write failed: ${putResult.error.message}`));
    }

    const now = new Date();
    const copy: FileRecord = {
      ...source,
      id: uuidv7(),
      bucketId: parsedDest.data.bucketId,
      storageKey: destKey,
      filename: newFilename,
      folderPath: parsedDest.data.folderPath,
      ...(putResult.value.etag !== undefined ? { etag: putResult.value.etag } : {}),
      uploaderUserId: ctx.userId,
      createdAt: now,
      updatedAt: now,
    };

    const createResult = await this.fileRecords.create(copy);
    if (createResult.isErr()) return err(new InternalError(createResult.error.message));

    await this._incrementQuota(ctx.workspaceId, source.sizeBytes);

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FILE_COPIED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: copy.id },
      action: 'copied',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { sourceFileId: fileId, destFileId: copy.id },
      ...auditMeta(ctx),
    });

    await this._emitStorageEvent('file.created', ctx.workspaceId, { fileId: copy.id });
    return ok(copy);
  }

  private async _moveFile(
    ctx: RequestContext,
    fileId: string,
    destination: FileLocation,
  ): Promise<Result<FileRecord, AppError>> {
    // Validate
    const parsedDest = FileLocationSchema.safeParse(destination);
    if (!parsedDest.success) {
      return err(
        new ValidationError(
          'Invalid destination',
          parsedDest.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const sourceResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (sourceResult.isErr()) return err(new InternalError(sourceResult.error.message));
    if (!sourceResult.value) return err(new NotFoundError('file_record', fileId));
    const source = sourceResult.value;

    // Copy bytes to new key
    const getResult = await this.storage.get(source.storageKey);
    if (getResult.isErr()) return err(new InternalError(getResult.error.message));

    const newFilename = parsedDest.data.filename ?? source.filename;
    const destKey = this._buildStorageKey(
      ctx.workspaceId,
      parsedDest.data.bucketId,
      parsedDest.data.folderPath,
      newFilename,
    );

    const chunks: Buffer[] = [];
    for await (const chunk of getResult.value as AsyncIterable<Buffer | string>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const putResult = await this.storage.put(destKey, Buffer.concat(chunks), {
      ...(source.contentType !== undefined ? { contentType: source.contentType } : {}),
    });
    if (putResult.isErr()) return err(new InternalError(putResult.error.message));

    // Delete old key
    await this.storage.delete(source.storageKey);

    const moved: FileRecord = {
      ...source,
      bucketId: parsedDest.data.bucketId,
      storageKey: destKey,
      filename: newFilename,
      folderPath: parsedDest.data.folderPath,
      ...(putResult.value.etag !== undefined ? { etag: putResult.value.etag } : {}),
      updatedAt: new Date(),
    };

    const updateResult = await this.fileRecords.update(fileId, moved);
    if (updateResult.isErr()) return err(new InternalError(updateResult.error.message));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FILE_MOVED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'moved',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { from: source.storageKey, to: destKey },
      ...auditMeta(ctx),
    });

    await this._emitStorageEvent('file.moved', ctx.workspaceId, {
      fileId,
      from: source.storageKey,
      to: destKey,
    });
    return ok(moved);
  }

  private async _renameFile(
    ctx: RequestContext,
    fileId: string,
    newName: string,
  ): Promise<Result<FileRecord, AppError>> {
    if (!newName || newName.length > 500) {
      return err(
        new ValidationError('Invalid filename', [
          { path: 'newName', message: 'Must be 1-500 characters' },
        ]),
      );
    }

    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const fileResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (fileResult.isErr()) return err(new InternalError(fileResult.error.message));
    if (!fileResult.value) return err(new NotFoundError('file_record', fileId));

    // Move to same location but with the new filename
    const moveResult = await this._moveFile(ctx, fileId, {
      bucketId: fileResult.value.bucketId,
      folderPath: fileResult.value.folderPath,
      filename: newName,
    });
    if (moveResult.isErr()) return moveResult;

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FILE_RENAMED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'renamed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { from: fileResult.value.filename, to: newName },
      ...auditMeta(ctx),
    });

    return ok(moveResult.value);
  }

  private async _deleteFile(ctx: RequestContext, fileId: string): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.delete', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const fileResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (fileResult.isErr()) return err(new InternalError(fileResult.error.message));
    if (!fileResult.value) return err(new NotFoundError('file_record', fileId));

    const file = fileResult.value;

    // Check file-level ACL
    const canDelete = await this._checkFileAcl(ctx, file, 'delete');
    if (!canDelete) return err(new ForbiddenError('Access denied by file ACL'));

    // Archive the DB record first (so concurrent reads don't find it)
    const archiveResult = await this.fileRecords.archive(fileId);
    if (archiveResult.isErr()) return err(new InternalError(archiveResult.error.message));

    // Then delete from storage (also delete thumbnails)
    await this.storage.delete(file.storageKey);
    await this._deleteThumbnails(file.storageKey);

    // Update quota
    await this._decrementQuota(ctx.workspaceId, file.sizeBytes);

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FILE_DELETED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'deleted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { filename: file.filename, sizeBytes: file.sizeBytes },
      ...auditMeta(ctx),
    });

    await this._emitStorageEvent('file.deleted', ctx.workspaceId, {
      fileId,
      bucketId: file.bucketId,
    });
    return ok(undefined);
  }

  private async _bulkDelete(
    ctx: RequestContext,
    fileIds: string[],
  ): Promise<Result<BulkOperationResult, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    if (fileIds.length === 0 || fileIds.length > 1000) {
      return err(
        new ValidationError('fileIds must have 1–1000 entries', [
          { path: 'fileIds', message: 'length out of range' },
        ]),
      );
    }

    const authResult = await this.authz.authorize(ctx, 'storage_file.delete', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result: BulkOperationResult = { succeeded: [], failed: [] };

    for (const fileId of fileIds) {
      const delResult = await this._deleteFile(ctx, fileId);
      if (delResult.isOk()) {
        result.succeeded.push(fileId);
      } else {
        result.failed.push({ fileId, reason: delResult.error.message });
      }
    }

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.BULK_DELETE,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'storage', id: ctx.workspaceId },
      action: 'bulk_deleted',
      outcome: result.failed.length === 0 ? 'success' : 'failure',
      correlationId: ctx.correlationId,
      metadata: {
        total: fileIds.length,
        succeeded: result.succeeded.length,
        failed: result.failed.length,
      },
      ...auditMeta(ctx),
    });

    return ok(result);
  }

  private async _bulkMove(
    ctx: RequestContext,
    fileIds: string[],
    destination: FileLocation,
  ): Promise<Result<BulkOperationResult, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    if (fileIds.length === 0 || fileIds.length > 1000) {
      return err(
        new ValidationError('fileIds must have 1–1000 entries', [
          { path: 'fileIds', message: 'length out of range' },
        ]),
      );
    }

    const parsedDest = FileLocationSchema.safeParse(destination);
    if (!parsedDest.success) {
      return err(
        new ValidationError(
          'Invalid destination',
          parsedDest.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result: BulkOperationResult = { succeeded: [], failed: [] };

    const resolvedDestination: FileLocation = {
      bucketId: parsedDest.data.bucketId,
      folderPath: parsedDest.data.folderPath,
      ...(parsedDest.data.filename !== undefined ? { filename: parsedDest.data.filename } : {}),
    };

    for (const fileId of fileIds) {
      const moveResult = await this._moveFile(ctx, fileId, resolvedDestination);
      if (moveResult.isOk()) {
        result.succeeded.push(fileId);
      } else {
        result.failed.push({ fileId, reason: moveResult.error.message });
      }
    }

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.BULK_MOVE,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'storage', id: ctx.workspaceId },
      action: 'bulk_moved',
      outcome: result.failed.length === 0 ? 'success' : 'failure',
      correlationId: ctx.correlationId,
      metadata: {
        total: fileIds.length,
        succeeded: result.succeeded.length,
        failed: result.failed.length,
      },
      ...auditMeta(ctx),
    });

    return ok(result);
  }

  private async _createFolder(
    ctx: RequestContext,
    bucketId: string,
    path: string,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const bucketResult = await this.buckets.findOne({
      id: { _eq: bucketId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<BucketRepo['findOne']>[0]);
    if (bucketResult.isErr()) return err(new InternalError(bucketResult.error.message));
    if (!bucketResult.value) return err(new NotFoundError('storage_bucket', bucketId));

    // Create a .keep placeholder object to represent the empty folder
    const keepKey = this._buildStorageKey(ctx.workspaceId, bucketId, path, KEEP_FILE_PLACEHOLDER);
    const putResult = await this.storage.put(keepKey, Buffer.alloc(0), {
      contentType: 'application/x-directory',
    });
    if (putResult.isErr()) {
      return err(
        new InternalError(`Failed to create folder placeholder: ${putResult.error.message}`),
      );
    }

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FOLDER_CREATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'storage_folder', id: `${bucketId}/${path}` },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { bucketId, path },
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _deleteFolder(
    ctx: RequestContext,
    bucketId: string,
    path: string,
  ): Promise<Result<BulkOperationResult, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.delete', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // List all files in this folder
    const filesResult = await this.fileRecords.findMany({
      filter: {
        bucketId: { _eq: bucketId },
        workspaceId: { _eq: ctx.workspaceId },
        folderPath: { _eq: path },
        status: { _neq: 'deleted' },
      },
    } as Parameters<FileRecordRepo['findMany']>[0]);
    if (filesResult.isErr()) return err(new InternalError(filesResult.error.message));

    const result = await this._bulkDelete(
      ctx,
      filesResult.value.items.map((f) => f.id),
    );
    if (result.isErr()) return result;

    // Delete the .keep placeholder if present
    const keepKey = this._buildStorageKey(ctx.workspaceId, bucketId, path, KEEP_FILE_PLACEHOLDER);
    await this.storage.delete(keepKey);

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FOLDER_DELETED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'storage_folder', id: `${bucketId}/${path}` },
      action: 'deleted',
      outcome: result.value.failed.length === 0 ? 'success' : 'failure',
      correlationId: ctx.correlationId,
      metadata: { bucketId, path },
      ...auditMeta(ctx),
    });

    return result;
  }

  private async _moveFolder(
    ctx: RequestContext,
    bucketId: string,
    fromPath: string,
    toPath: string,
  ): Promise<Result<BulkOperationResult, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const filesResult = await this.fileRecords.findMany({
      filter: {
        bucketId: { _eq: bucketId },
        workspaceId: { _eq: ctx.workspaceId },
        folderPath: { _eq: fromPath },
        status: { _neq: 'deleted' },
      },
    } as Parameters<FileRecordRepo['findMany']>[0]);
    if (filesResult.isErr()) return err(new InternalError(filesResult.error.message));

    const result = await this._bulkMove(
      ctx,
      filesResult.value.items.map((f) => f.id),
      { bucketId, folderPath: toPath },
    );
    if (result.isErr()) return result;

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FOLDER_MOVED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'storage_folder', id: `${bucketId}/${fromPath}` },
      action: 'moved',
      outcome: result.value.failed.length === 0 ? 'success' : 'failure',
      correlationId: ctx.correlationId,
      metadata: { bucketId, from: fromPath, to: toPath },
      ...auditMeta(ctx),
    });

    return result;
  }

  private async _createSignedUrl(
    ctx: RequestContext,
    fileId: string,
    opts: SignedUrlOptions,
  ): Promise<Result<SignedUrlRecord, AppError>> {
    // 1. Validate
    const parsed = SignedUrlOptionsSchema.safeParse(opts);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid signed URL options',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. File must exist
    const fileResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (fileResult.isErr()) return err(new InternalError(fileResult.error.message));
    if (!fileResult.value) return err(new NotFoundError('file_record', fileId));

    // 4. Execute
    const ttl = parsed.data.ttlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS;
    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 1000);

    const record: SignedUrlRecord = {
      id: uuidv7(),
      workspaceId: ctx.workspaceId,
      fileId,
      tokenHash,
      token: plainToken, // returned once; not stored in plain
      createdByUserId: ctx.userId,
      expiresAt,
      downloadCount: 0,
      directMode: parsed.data.directMode ?? false,
      ...(parsed.data.downloadLimit !== undefined
        ? { downloadLimit: parsed.data.downloadLimit }
        : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      createdAt: now,
    };

    // Store with hashed token (never store plain)
    const storedRecord = { ...record, token: '' }; // blank token in DB; plain only returned once
    const createResult = await this.signedUrls.create(storedRecord);
    if (createResult.isErr()) return err(new InternalError(createResult.error.message));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.SIGNED_URL_CREATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'signed_url', id: record.id },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        fileId,
        ttlSeconds: ttl,
        directMode: record.directMode,
        ...(record.downloadLimit !== undefined ? { downloadLimit: record.downloadLimit } : {}),
      },
      ...auditMeta(ctx),
    });

    return ok(record); // token is returned plain here
  }

  private async _revokeSignedUrl(
    ctx: RequestContext,
    signedUrlId: string,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const urlResult = await this.signedUrls.findOne({
      id: { _eq: signedUrlId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<SignedUrlRepo['findOne']>[0]);
    if (urlResult.isErr()) return err(new InternalError(urlResult.error.message));
    if (!urlResult.value) return err(new NotFoundError('signed_url', signedUrlId));
    if (urlResult.value.revokedAt) {
      return err(new ConflictError('Signed URL is already revoked'));
    }

    const updateResult = await this.signedUrls.update(signedUrlId, {
      ...urlResult.value,
      revokedAt: new Date(),
    });
    if (updateResult.isErr()) return err(new InternalError(updateResult.error.message));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.SIGNED_URL_REVOKED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'signed_url', id: signedUrlId },
      action: 'revoked',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { fileId: urlResult.value.fileId },
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _resolveSignedUrl(
    token: string,
  ): Promise<Result<{ fileId: string; storageUrl: string; cachePublic: boolean }, AppError>> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const urlResult = await this.signedUrls.findOne({
      tokenHash: { _eq: tokenHash },
    } as Parameters<SignedUrlRepo['findOne']>[0]);
    if (urlResult.isErr()) return err(new InternalError(urlResult.error.message));
    if (!urlResult.value) return err(new NotFoundError('signed_url', 'token'));

    const record = urlResult.value;
    if (record.revokedAt) return err(new ForbiddenError('Signed URL has been revoked'));
    if (record.expiresAt < new Date()) return err(new ForbiddenError('Signed URL has expired'));
    if (record.downloadLimit !== undefined && record.downloadCount >= record.downloadLimit) {
      return err(new ForbiddenError('Signed URL download limit reached'));
    }

    // Increment download count
    await this.signedUrls.update(record.id, {
      ...record,
      downloadCount: record.downloadCount + 1,
    });

    // Get file record
    const fileResult = await this.fileRecords.findOne({
      id: { _eq: record.fileId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (fileResult.isErr()) return err(new InternalError(fileResult.error.message));
    if (!fileResult.value) return err(new NotFoundError('file_record', record.fileId));

    // Check if the bucket has cachePublic enabled (stored in metadata)
    const bucketResult = await this.buckets.findOne({
      id: { _eq: fileResult.value.bucketId },
    } as Parameters<BucketRepo['findOne']>[0]);
    const cachePublic =
      bucketResult.isOk() &&
      bucketResult.value !== null &&
      bucketResult.value.metadata['cachePublic'] === true;

    let storageUrl: string;
    if (record.directMode) {
      // Generate a short-lived direct URL from the storage adapter
      const signResult = await this.storage.signedUrl(fileResult.value.storageKey, 'GET', {
        expiresIn: 300, // 5 min short-lived
      });
      if (signResult.isErr()) return err(new InternalError(signResult.error.message));
      storageUrl = signResult.value;
    } else {
      // Return a platform proxy URL (caller handles serving)
      storageUrl = `/api/v1/storage/proxy/${record.id}`;
    }

    return ok({ fileId: record.fileId, storageUrl, cachePublic });
  }

  private async _setTags(
    ctx: RequestContext,
    fileId: string,
    tags: string[],
  ): Promise<Result<FileRecord, AppError>> {
    const parsed = SetTagsInputSchema.safeParse({ tags });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid tags',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const fileResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (fileResult.isErr()) return err(new InternalError(fileResult.error.message));
    if (!fileResult.value) return err(new NotFoundError('file_record', fileId));

    const updated = { ...fileResult.value, tags: parsed.data.tags, updatedAt: new Date() };
    const updateResult = await this.fileRecords.update(fileId, updated);
    if (updateResult.isErr()) return err(new InternalError(updateResult.error.message));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.TAGS_UPDATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'tags_updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { tags: parsed.data.tags },
      ...auditMeta(ctx),
    });

    return ok(updated);
  }

  private async _setMetadata(
    ctx: RequestContext,
    fileId: string,
    metadata: Record<string, unknown>,
  ): Promise<Result<FileRecord, AppError>> {
    const parsed = SetMetadataInputSchema.safeParse({ metadata });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid metadata',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const fileResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (fileResult.isErr()) return err(new InternalError(fileResult.error.message));
    if (!fileResult.value) return err(new NotFoundError('file_record', fileId));

    const updated = {
      ...fileResult.value,
      customMetadata: parsed.data.metadata,
      updatedAt: new Date(),
    };
    const updateResult = await this.fileRecords.update(fileId, updated);
    if (updateResult.isErr()) return err(new InternalError(updateResult.error.message));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.METADATA_UPDATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'metadata_updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { keys: Object.keys(parsed.data.metadata) },
      ...auditMeta(ctx),
    });

    return ok(updated);
  }

  private async _setFileAcl(
    ctx: RequestContext,
    fileId: string,
    acl: Record<string, string[]>,
  ): Promise<Result<void, AppError>> {
    const parsed = FileAclInputSchema.safeParse({ acl });
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid ACL',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const fileResult = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: ctx.workspaceId },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (fileResult.isErr()) return err(new InternalError(fileResult.error.message));
    if (!fileResult.value) return err(new NotFoundError('file_record', fileId));

    const existing = await this.fileAcls.findOne({
      fileId: { _eq: fileId },
    } as Parameters<FileAclRepo['findOne']>[0]);

    const now = new Date();
    if (existing.isOk() && existing.value) {
      await this.fileAcls.update(existing.value.id, {
        ...existing.value,
        acl: parsed.data.acl,
        updatedAt: now,
      });
    } else {
      await this.fileAcls.create({
        id: uuidv7(),
        fileId,
        acl: parsed.data.acl,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.ACL_SET,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'acl_set',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { principals: Object.keys(parsed.data.acl) },
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _removeFileAcl(
    ctx: RequestContext,
    fileId: string,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_file.write', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const existing = await this.fileAcls.findOne({
      fileId: { _eq: fileId },
    } as Parameters<FileAclRepo['findOne']>[0]);
    if (existing.isErr()) return err(new InternalError(existing.error.message));
    if (!existing.value) return ok(undefined); // No ACL to remove

    const deleteResult = await this.fileAcls.hardDelete(existing.value.id);
    if (deleteResult.isErr()) return err(new InternalError(deleteResult.error.message));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.ACL_REMOVED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'acl_removed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _getQuota(ctx: RequestContext): Promise<Result<StorageQuota, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(ctx, 'storage_bucket.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const quota = await this._ensureQuota(ctx.workspaceId);
    return ok(quota);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _buildStorageKey(
    workspaceId: string,
    bucketId: string,
    folderPath: string,
    filename: string,
  ): string {
    const parts = [workspaceId, bucketId, ...(folderPath ? [folderPath] : []), filename];
    return parts.join('/');
  }

  private async _ensureQuota(workspaceId: string): Promise<StorageQuota> {
    const existing = await this.quotas.findOne({
      workspaceId: { _eq: workspaceId },
    } as Parameters<QuotaRepo['findOne']>[0]);

    if (existing.isOk() && existing.value) return existing.value;

    const now = new Date();
    const quota: StorageQuota = {
      id: uuidv7(),
      workspaceId,
      quotaBytes: DEFAULT_QUOTA_BYTES,
      usedBytes: 0,
      warningSent80: false,
      warningSent95: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.quotas.create(quota);
    return quota;
  }

  private async _enforceQuota(
    workspaceId: string,
    uploadBytes: number,
  ): Promise<Result<void, AppError>> {
    const quota = await this._ensureQuota(workspaceId);
    if (quota.usedBytes + uploadBytes > quota.quotaBytes) {
      return err(
        new InternalError(
          `Storage quota exceeded: ${String(quota.usedBytes + uploadBytes)} > ${String(quota.quotaBytes)} bytes`,
        ),
      );
    }
    return ok(undefined);
  }

  private async _incrementQuota(workspaceId: string, bytes: number): Promise<void> {
    const quota = await this._ensureQuota(workspaceId);
    await this.quotas.update(quota.id, {
      ...quota,
      usedBytes: quota.usedBytes + bytes,
      updatedAt: new Date(),
    });
  }

  private async _decrementQuota(workspaceId: string, bytes: number): Promise<void> {
    const quota = await this._ensureQuota(workspaceId);
    await this.quotas.update(quota.id, {
      ...quota,
      usedBytes: Math.max(0, quota.usedBytes - bytes),
      updatedAt: new Date(),
    });
  }

  private async _checkQuotaWarnings(workspaceId: string): Promise<void> {
    const quota = await this._ensureQuota(workspaceId);
    const ratio = quota.usedBytes / quota.quotaBytes;

    if (ratio >= QUOTA_WARNING_95_THRESHOLD && !quota.warningSent95) {
      await this.quotas.update(quota.id, { ...quota, warningSent95: true, updatedAt: new Date() });
      await this.audit.write({
        eventType: STORAGE_AUDIT_EVENTS.QUOTA_WARNING_95,
        workspaceId,
        actor: { kind: 'system', id: null },
        resource: { type: 'storage_quota', id: workspaceId },
        action: 'quota_warning',
        outcome: 'success',
        correlationId: workspaceId,
        metadata: { usedBytes: quota.usedBytes, quotaBytes: quota.quotaBytes },
      });
      this.metrics
        ?.counter('platform_storage_quota_warnings_total', {
          description: 'Storage quota warnings fired',
        })
        .add(1, { workspace: workspaceId, level: '95' });
    } else if (ratio >= QUOTA_WARNING_80_THRESHOLD && !quota.warningSent80) {
      await this.quotas.update(quota.id, { ...quota, warningSent80: true, updatedAt: new Date() });
      await this.audit.write({
        eventType: STORAGE_AUDIT_EVENTS.QUOTA_WARNING_80,
        workspaceId,
        actor: { kind: 'system', id: null },
        resource: { type: 'storage_quota', id: workspaceId },
        action: 'quota_warning',
        outcome: 'success',
        correlationId: workspaceId,
        metadata: { usedBytes: quota.usedBytes, quotaBytes: quota.quotaBytes },
      });
      this.metrics
        ?.counter('platform_storage_quota_warnings_total', {
          description: 'Storage quota warnings fired',
        })
        .add(1, { workspace: workspaceId, level: '80' });
    }

    this.metrics
      ?.gauge('platform_storage_bytes_used', { description: 'Storage bytes used per workspace' })
      .set(quota.usedBytes, { workspace: workspaceId });
  }

  private async _checkFileAcl(
    ctx: RequestContext,
    file: FileRecord,
    action: 'read' | 'write' | 'delete',
  ): Promise<boolean> {
    const aclResult = await this.fileAcls.findOne({
      fileId: { _eq: file.id },
    } as Parameters<FileAclRepo['findOne']>[0]);

    if (aclResult.isErr() || !aclResult.value) return true; // No ACL = inherit bucket default

    const acl = aclResult.value.acl;
    const userId = ctx.userId;

    // Check user-specific grant
    if (userId) {
      const userGrant = acl[`user:${userId}`];
      if (userGrant) return userGrant.includes(action);
    }

    // Check role grants
    const roles: string[] = (ctx as unknown as { roles?: string[] }).roles ?? [];
    for (const role of roles) {
      const roleGrant = acl[`role:${role}`];
      if (roleGrant && roleGrant.includes(action)) return true;
    }

    return false; // ACL present but no matching grant
  }

  private async _deleteThumbnails(storageKey: string): Promise<void> {
    const thumbnailPrefix = `${storageKey}/.thumbnails/`;
    const listResult = await this.storage.list(thumbnailPrefix);
    if (listResult.isErr()) return;

    for (const obj of listResult.value.objects) {
      await this.storage.delete(obj.key);
    }
  }

  private async _emitStorageEvent(
    type: StorageRealtimeEvent['type'],
    workspaceId: string,
    payload: unknown,
  ): Promise<void> {
    if (!this.events) return;
    const topic = `workspace:${workspaceId}:storage`;
    await this.events.publish(topic, { type, workspaceId, payload });
  }

  private async _downloadFile(
    ctx: RequestContext,
    fileId: string,
  ): Promise<Result<{ stream: Readable; contentType: string; filename: string }, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    const wid = ctx.workspaceId;

    const authResult = await this.authz.authorize(ctx, 'storage_file.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: wid },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value) return err(new NotFoundError('file_record', fileId));

    const record = result.value;
    const streamResult = await this.storage.get(record.storageKey);
    if (streamResult.isErr())
      return err(new InternalError(`Storage get failed: ${streamResult.error.message}`));

    await this.audit.write({
      eventType: STORAGE_AUDIT_EVENTS.FILE_DOWNLOADED,
      workspaceId: wid,
      actor: toAuditActor(ctx),
      resource: { type: 'file_record', id: fileId },
      action: 'downloaded',
      outcome: 'success',
      correlationId: ctx.correlationId,
    });

    return ok({
      stream: streamResult.value as unknown as Readable,
      contentType: record.contentType ?? 'application/octet-stream',
      filename: record.filename,
    });
  }

  private async _getOrGenerateThumbnailUrl(
    ctx: RequestContext,
    fileId: string,
    size: 'small' | 'medium' | 'large',
    transform: (stream: Readable, contentType: string) => Promise<Buffer>,
  ): Promise<Result<string, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    const wid = ctx.workspaceId;

    const authResult = await this.authz.authorize(ctx, 'storage_file.read', 'storage');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const result = await this.fileRecords.findOne({
      id: { _eq: fileId },
      workspaceId: { _eq: wid },
    } as Parameters<FileRecordRepo['findOne']>[0]);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value) return err(new NotFoundError('file_record', fileId));

    const record = result.value;
    const thumbnailKey = `${record.storageKey}/${THUMBNAIL_PREFIX}/${size}.jpg`;

    // Check if thumbnail already exists
    const headResult = await this.storage.head(thumbnailKey);
    const thumbnailExists = headResult.isOk() && headResult.value !== null;

    if (!thumbnailExists) {
      const originalStream = await this.storage.get(record.storageKey);
      if (originalStream.isErr()) {
        return err(
          new InternalError(`Cannot read original for thumbnail: ${originalStream.error.message}`),
        );
      }

      let thumbnailData: Buffer;
      try {
        thumbnailData = await transform(
          originalStream.value as unknown as Readable,
          record.contentType ?? 'image/jpeg',
        );
      } catch (e) {
        return err(new InternalError(`Thumbnail generation failed: ${String(e)}`));
      }

      const putResult = await this.storage.put(thumbnailKey, thumbnailData, {
        contentType: 'image/jpeg',
      });
      if (putResult.isErr()) {
        this.logger.warn('Thumbnail put failed', { thumbnailKey, error: putResult.error.message });
      } else {
        await this.audit.write({
          eventType: STORAGE_AUDIT_EVENTS.PREVIEW_GENERATED,
          workspaceId: wid,
          actor: toAuditActor(ctx),
          resource: { type: 'file_record', id: fileId },
          action: 'preview_generated',
          outcome: 'success',
          correlationId: ctx.correlationId,
          metadata: { size },
        });
      }
    }

    // Return a short-lived signed URL to the thumbnail
    const signedResult = await this.storage.signedUrl(thumbnailKey, 'GET', { expiresIn: 300 });
    if (signedResult.isErr()) {
      // Fallback: signed URL for original when adapter doesn't support signed URLs
      const fallback = await this.storage.signedUrl(record.storageKey, 'GET', { expiresIn: 300 });
      if (fallback.isErr()) return err(new InternalError('Cannot generate preview URL'));
      return ok(fallback.value);
    }

    return ok(signedResult.value);
  }
}
