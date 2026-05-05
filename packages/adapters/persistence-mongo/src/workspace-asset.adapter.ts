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
import type { AssetNotFoundError, AssetQuotaExceededError } from '@platform/ports-workspace-assets';

import { AssetStorageError } from '@platform/ports-workspace-assets';
import { err, type Result } from 'neverthrow';

/**
 * MongoDB adapter for WorkspaceAssetPort.
 *
 * Not yet implemented — tracked in GitHub issue.
 * All methods return AssetStorageError with a clear message.
 * Wire the Postgres adapter for Postgres installations until this is complete.
 */
export class MongoWorkspaceAssetAdapter implements WorkspaceAssetPort {
  private _notImplemented(): AssetStorageError {
    return new AssetStorageError(
      'MongoWorkspaceAssetAdapter is not yet implemented. ' + 'See GitHub issue for tracking.',
    );
  }

  upload(
    _input: UploadAssetInput,
  ): Promise<Result<WorkspaceAsset, AssetQuotaExceededError | AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  replace(
    _input: ReplaceAssetInput,
  ): Promise<Result<WorkspaceAsset, AssetNotFoundError | AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  delete(
    _workspaceId: string,
    _assetId: string,
  ): Promise<Result<void, AssetNotFoundError | AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  listByCategory(
    _workspaceId: string,
    _topLevel: AssetTopLevel,
    _category: AssetCategory,
  ): Promise<Result<WorkspaceAsset[], AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  listByContext(
    _workspaceId: string,
    _context: StageAssetContext,
  ): Promise<Result<ContextualAsset[], AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  getQuota(_workspaceId: string): Promise<Result<WorkspaceAssetQuota, AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  findById(
    _workspaceId: string,
    _assetId: string,
  ): Promise<Result<WorkspaceAsset | null, AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  recordConsumedAssets(
    _workspaceId: string,
    _generationId: string,
    _snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<void, AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }

  checkStaleness(
    _workspaceId: string,
    _snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<StalenessCheck, AssetStorageError>> {
    return Promise.resolve(err(this._notImplemented()));
  }
}
