// Domain types for the Storage module.
// These live in the port so both the service (core) and adapters share the same language.

// ── Enums ─────────────────────────────────────────────────────────────────────

export type StorageClass = 'standard' | 'infrequent' | 'archive';

export type FileStatus = 'uploading' | 'available' | 'archiving' | 'deleted';

export type PiiCategory = string;

// ── Bucket ────────────────────────────────────────────────────────────────────

export interface Bucket {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  defaultRoleGrants: Record<string, string[]>; // { roleId: ['read', 'write'] }
  defaultPiiFlag: boolean;
  storageClass: StorageClass;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface CreateBucketInput {
  name: string;
  slug: string;
  description?: string;
  defaultRoleGrants?: Record<string, string[]>;
  defaultPiiFlag?: boolean;
  storageClass?: StorageClass;
  metadata?: Record<string, unknown>;
}

export interface BucketUpdate {
  name?: string;
  description?: string;
  defaultRoleGrants?: Record<string, string[]>;
  defaultPiiFlag?: boolean;
  storageClass?: StorageClass;
  metadata?: Record<string, unknown>;
}

// ── File record ───────────────────────────────────────────────────────────────

export interface FileRecord {
  id: string;
  workspaceId: string;
  bucketId: string;
  storageKey: string;
  filename: string;
  folderPath: string; // logical folder path within the bucket ('' = root)
  sizeBytes: number;
  contentType?: string;
  etag?: string;
  uploaderUserId?: string;
  tags: string[];
  customMetadata: Record<string, unknown>;
  piiFlag: boolean;
  piiCategories: PiiCategory[];
  status: FileStatus;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileLocation {
  bucketId: string;
  folderPath: string;
  filename?: string; // if absent, keep the original filename
}

export interface UploadFileInput {
  bucketId: string;
  folderPath?: string;
  filename: string;
  contentType?: string;
  sizeBytes: number;
  tags?: string[];
  customMetadata?: Record<string, unknown>;
  piiFlag?: boolean;
  piiCategories?: PiiCategory[];
}

export interface ListFilesOptions {
  bucketId?: string;
  folderPath?: string;
  tags?: string[];
  search?: string; // filename / metadata search
  status?: FileStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'filename' | 'size' | 'createdAt' | 'updatedAt';
  sortDir?: 'asc' | 'desc';
}

// ── File ACL ──────────────────────────────────────────────────────────────────

export interface FileAcl {
  id: string;
  fileId: string;
  acl: Record<string, string[]>; // { 'user:<id>' | 'role:<id>': ['read', 'write'] }
  createdAt: Date;
  updatedAt: Date;
}

// ── Signed URL ────────────────────────────────────────────────────────────────

export interface SignedUrlRecord {
  id: string;
  workspaceId: string;
  fileId: string;
  tokenHash: string;
  token: string; // plain token returned once on creation
  createdByUserId?: string;
  expiresAt: Date;
  revokedAt?: Date;
  downloadLimit?: number;
  downloadCount: number;
  description?: string;
  directMode: boolean; // points at storage backend directly (no revocability)
  createdAt: Date;
}

export interface SignedUrlOptions {
  ttlSeconds?: number; // default 3600 (1 hour), max 604800 (7 days)
  downloadLimit?: number;
  description?: string;
  directMode?: boolean;
}

// ── Quota ─────────────────────────────────────────────────────────────────────

export interface StorageQuota {
  id: string;
  workspaceId: string;
  quotaBytes: number;
  usedBytes: number;
  warningSent80: boolean;
  warningSent95: boolean;
  lastReconciledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export interface BulkOperationResult {
  succeeded: string[]; // file IDs that succeeded
  failed: Array<{ fileId: string; reason: string }>; // partial failures
}

// ── Paginated result ──────────────────────────────────────────────────────────

export interface StoragePaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
