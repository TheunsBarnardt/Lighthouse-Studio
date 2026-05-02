export type ConfigErrorCode = 'SECRET_NOT_FOUND' | 'ACCESS_DENIED' | 'PROVIDER_ERROR' | 'UNKNOWN';

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;
  override readonly cause?: unknown;
  constructor(code: ConfigErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    this.cause = cause;
  }
}
