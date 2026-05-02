import { z } from 'zod';

export type IdentityErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_NOT_FOUND'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'MFA_REQUIRED'
  | 'MFA_FAILED'
  | 'PROVIDER_ERROR'
  | 'NOT_SUPPORTED'
  | 'UNKNOWN';

export class IdentityError extends Error {
  readonly code: IdentityErrorCode;
  override readonly cause?: unknown;
  constructor(code: IdentityErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
    this.cause = cause;
  }
}

export const IdentityErrorCodeSchema = z.enum([
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'ACCOUNT_NOT_FOUND',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'MFA_REQUIRED',
  'MFA_FAILED',
  'PROVIDER_ERROR',
  'NOT_SUPPORTED',
  'UNKNOWN',
]);
