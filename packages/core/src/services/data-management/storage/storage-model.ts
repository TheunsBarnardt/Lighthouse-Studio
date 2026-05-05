import { z } from 'zod';

// ── Zod schemas (service boundary validation) ─────────────────────────────────

export const CreateBucketInputSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(1000).optional(),
  defaultRoleGrants: z.record(z.array(z.string())).optional(),
  defaultPiiFlag: z.boolean().optional(),
  storageClass: z.enum(['standard', 'infrequent', 'archive']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const BucketUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  defaultRoleGrants: z.record(z.array(z.string())).optional(),
  defaultPiiFlag: z.boolean().optional(),
  storageClass: z.enum(['standard', 'infrequent', 'archive']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UploadFileInputSchema = z.object({
  bucketId: z.string().uuid(),
  folderPath: z.string().max(2048).optional(),
  filename: z.string().min(1).max(500),
  contentType: z.string().max(255).optional(),
  sizeBytes: z.number().int().nonnegative(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  customMetadata: z.record(z.unknown()).optional(),
  piiFlag: z.boolean().optional(),
  piiCategories: z.array(z.string()).optional(),
});

export const ListFilesOptionsSchema = z.object({
  bucketId: z.string().uuid().optional(),
  folderPath: z.string().max(2048).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().max(500).optional(),
  status: z.enum(['uploading', 'available', 'archiving', 'deleted']).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  sortBy: z.enum(['filename', 'size', 'createdAt', 'updatedAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export const FileLocationSchema = z.object({
  bucketId: z.string().uuid(),
  folderPath: z.string().max(2048),
  filename: z.string().max(500).optional(),
});

export const SignedUrlOptionsSchema = z.object({
  ttlSeconds: z.number().int().min(60).max(604_800).optional(),
  downloadLimit: z.number().int().positive().optional(),
  description: z.string().max(500).optional(),
  directMode: z.boolean().optional(),
});

export const SetTagsInputSchema = z.object({
  tags: z.array(z.string().max(100)).max(50),
});

export const SetMetadataInputSchema = z.object({
  metadata: z.record(z.unknown()),
});

export const FileAclInputSchema = z.object({
  acl: z.record(z.array(z.string())),
});

// ── Constants ─────────────────────────────────────────────────────────────────

export const MULTIPART_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
export const DEFAULT_QUOTA_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600; // 1 hour
export const MAX_SIGNED_URL_TTL_SECONDS = 604_800; // 7 days
export const QUOTA_WARNING_80_THRESHOLD = 0.8;
export const QUOTA_WARNING_95_THRESHOLD = 0.95;
export const KEEP_FILE_PLACEHOLDER = '.keep';
export const THUMBNAIL_PREFIX = '.thumbnails';
