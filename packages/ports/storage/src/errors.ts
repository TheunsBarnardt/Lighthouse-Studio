export type StorageErrorCode =
  | 'OBJECT_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_ERROR'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  override readonly cause?: unknown;
  constructor(code: StorageErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
  }
}

export class ObjectNotFoundError extends Error {
  readonly code = 'OBJECT_NOT_FOUND' as const;
  constructor(public readonly key: string) {
    super(`Object not found: ${key}`);
    this.name = 'ObjectNotFoundError';
  }
}

export class NotSupportedError extends Error {
  readonly code = 'NOT_SUPPORTED' as const;
  constructor(public readonly feature: string) {
    super(`Not supported: ${feature}`);
    this.name = 'NotSupportedError';
  }
}
