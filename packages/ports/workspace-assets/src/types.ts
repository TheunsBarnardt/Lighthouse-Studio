import type { Readable } from 'node:stream';

// ── Category / role taxonomy ───────────────────────────────────────────────────

export type BrandCategory = 'logos' | 'colors' | 'fonts' | 'images' | 'icons';
export type DocumentCategory = 'voice' | 'strategy' | 'reference' | 'compliance' | 'specs';
export type AssetCategory = BrandCategory | DocumentCategory;
export type AssetTopLevel = 'brand' | 'documents';

/** Finer-grained role within a category (e.g. logo variant). Free-form string, optional. */
export type AssetRole = string;

// ── Validation ─────────────────────────────────────────────────────────────────

export type AssetValidationStatus = 'pending' | 'valid' | 'invalid' | 'unsupported_format';

export interface AssetValidationResult {
  status: AssetValidationStatus;
  /** Human-readable reason when status is 'invalid' or 'unsupported_format'. */
  reason?: string;
  /** WCAG AA compliance flag, populated for color assets. */
  wcagAA?: boolean;
}

// ── Core domain type ───────────────────────────────────────────────────────────

export interface WorkspaceAsset {
  id: string;
  version: number;
  workspaceId: string;
  topLevel: AssetTopLevel;
  category: AssetCategory;
  role: AssetRole | null;
  /** Original filename as uploaded. */
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** Path in blob storage: /workspaces/{workspaceId}/assets/{topLevel}/{category}/{id}/{filename} */
  storageKey: string;
  /** For parseable document formats: path to the extracted plain-text blob. */
  parsedTextKey: string | null;
  validationStatus: AssetValidationStatus;
  validationReason: string | null;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Quota ──────────────────────────────────────────────────────────────────────

export interface WorkspaceAssetQuota {
  workspaceId: string;
  /** Bytes currently used by workspace assets. */
  usedBytes: number;
  /** Configured allowance in bytes (default 1 073 741 824 = 1 GiB). */
  allowanceBytes: number;
}

// ── Stage context (ADR-0227) ────────────────────────────────────────────────────

export interface StageAssetContext {
  brand?: BrandCategory[];
  documents?: DocumentCategory[];
}

/** Asset returned by listByContext, decorated with the context role it fills. */
export interface ContextualAsset extends WorkspaceAsset {
  /** Which slot in the StageAssetContext this asset fills. */
  contextCategory: AssetCategory;
  /** Extracted plain text (for documents), null for binary assets or unparsed docs. */
  parsedText: string | null;
}

// ── Generation asset provenance (ADR-0228, criteria 4 & 5) ───────────────────

/**
 * Snapshot of which asset versions were consumed by a single generation run.
 * Stored as JSON in the generation record so staleness can be checked later.
 * Key = assetId.
 */
export interface ConsumedAssetEntry {
  version: number;
  category: AssetCategory;
  filename: string;
  topLevel: AssetTopLevel;
}

export type ConsumedAssetSnapshot = Record<string, ConsumedAssetEntry>;

/** One stale entry returned by checkStaleness. */
export interface StaleAssetEntry {
  assetId: string;
  category: AssetCategory;
  filename: string;
  /** Version at generation time. */
  previousVersion: number;
  /** Current version in the database. */
  currentVersion: number;
}

/** Result of comparing a stored snapshot against current asset versions. */
export interface StalenessCheck {
  /** True if any consumed asset has been updated since generation. */
  isStale: boolean;
  staleAssets: StaleAssetEntry[];
}

// ── Upload input ───────────────────────────────────────────────────────────────

export interface UploadAssetInput {
  workspaceId: string;
  topLevel: AssetTopLevel;
  category: AssetCategory;
  role?: AssetRole;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Readable | Buffer;
}

export interface ReplaceAssetInput {
  assetId: string;
  workspaceId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  data: Readable | Buffer;
}

export type { Readable };
