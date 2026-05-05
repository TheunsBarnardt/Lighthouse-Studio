import type { Result } from 'neverthrow';

import type { AssetNotFoundError, AssetQuotaExceededError, AssetStorageError } from './errors.js';
import type {
  AssetCategory,
  AssetTopLevel,
  ConsumedAssetSnapshot,
  ContextualAsset,
  ReplaceAssetInput,
  StalenessCheck,
  StageAssetContext,
  UploadAssetInput,
  WorkspaceAsset,
  WorkspaceAssetQuota,
} from './types.js';

export interface WorkspaceAssetPort {
  /**
   * Store a new asset, run format validation, parse text for document formats,
   * and increment the workspace quota counter.
   */
  upload(
    input: UploadAssetInput,
  ): Promise<Result<WorkspaceAsset, AssetQuotaExceededError | AssetStorageError>>;

  /**
   * Replace an existing asset's blob and re-run validation/parsing.
   * Bumps the asset's version, which triggers "would change if regenerated" flags
   * on any generation that consumed the previous version.
   */
  replace(
    input: ReplaceAssetInput,
  ): Promise<Result<WorkspaceAsset, AssetNotFoundError | AssetStorageError>>;

  /**
   * Permanently delete an asset and decrement the workspace quota counter.
   */
  delete(
    workspaceId: string,
    assetId: string,
  ): Promise<Result<void, AssetNotFoundError | AssetStorageError>>;

  /**
   * List all assets in a given top-level / category within a workspace.
   * Returns assets in updatedAt descending order.
   */
  listByCategory(
    workspaceId: string,
    topLevel: AssetTopLevel,
    category: AssetCategory,
  ): Promise<Result<WorkspaceAsset[], AssetStorageError>>;

  /**
   * Fetch assets for all categories declared in a stage context (ADR-0227).
   * Returns only the asset metadata + parsed text needed for prompt assembly.
   * Results are ordered by updatedAt descending within each category.
   */
  listByContext(
    workspaceId: string,
    context: StageAssetContext,
  ): Promise<Result<ContextualAsset[], AssetStorageError>>;

  /**
   * Return current quota usage and the configured allowance for a workspace.
   */
  getQuota(workspaceId: string): Promise<Result<WorkspaceAssetQuota, AssetStorageError>>;

  /**
   * Fetch a single asset by id.
   */
  findById(
    workspaceId: string,
    assetId: string,
  ): Promise<Result<WorkspaceAsset | null, AssetStorageError>>;

  /**
   * Record which asset versions were consumed by a generation run.
   * The generationId is an opaque string owned by the caller (Obj 20).
   * Safe to call with the same generationId multiple times (upserts).
   */
  recordConsumedAssets(
    workspaceId: string,
    generationId: string,
    snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<void, AssetStorageError>>;

  /**
   * Compare a stored snapshot against current asset versions.
   * Returns which assets have been updated since the snapshot was taken.
   * Used to power the "would change if regenerated" indicator (ADR-0228).
   */
  checkStaleness(
    workspaceId: string,
    snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<StalenessCheck, AssetStorageError>>;
}
