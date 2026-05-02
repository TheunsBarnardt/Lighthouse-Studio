export type SearchErrorCode =
  | 'INDEX_NOT_FOUND'
  | 'QUERY_FAILED'
  | 'PROVIDER_ERROR'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN';

export class SearchError extends Error {
  readonly code: SearchErrorCode;
  override readonly cause?: unknown;
  constructor(code: SearchErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'SearchError';
    this.code = code;
    this.cause = cause;
  }
}
