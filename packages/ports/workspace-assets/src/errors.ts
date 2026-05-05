export class AssetNotFoundError extends Error {
  readonly code = 'ASSET_NOT_FOUND' as const;
  constructor(assetId: string) {
    super(`Workspace asset '${assetId}' not found`);
    this.name = 'AssetNotFoundError';
  }
}

export class AssetQuotaExceededError extends Error {
  readonly code = 'ASSET_QUOTA_EXCEEDED' as const;
  constructor(workspaceId: string, usedBytes: number, allowanceBytes: number) {
    super(
      `Workspace '${workspaceId}' asset quota exceeded: ${String(usedBytes)} / ${String(allowanceBytes)} bytes used`,
    );
    this.name = 'AssetQuotaExceededError';
  }
}

export class AssetStorageError extends Error {
  readonly code = 'ASSET_STORAGE_ERROR' as const;
  constructor(message: string) {
    super(message);
    this.name = 'AssetStorageError';
  }
}

export type WorkspaceAssetError = AssetNotFoundError | AssetQuotaExceededError | AssetStorageError;
