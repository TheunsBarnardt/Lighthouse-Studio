import { z } from 'zod';

export type PersistenceErrorCode =
  | 'CONNECTION_FAILED'
  | 'TIMEOUT'
  | 'CONSTRAINT_VIOLATION'
  | 'DEADLOCK'
  | 'PERMISSION_DENIED'
  | 'UNKNOWN';

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  override readonly cause?: unknown;
  constructor(code: PersistenceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
    this.cause = cause;
  }
}

export class EntityNotFoundError extends Error {
  readonly code = 'ENTITY_NOT_FOUND' as const;
  constructor(
    public readonly entityType: string,
    public readonly id: string,
  ) {
    super(`${entityType} not found: ${id}`);
    this.name = 'EntityNotFoundError';
  }
}

export class ConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  constructor(
    public readonly reason: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(reason);
    this.name = 'ConflictError';
  }
}

export class DdlError extends Error {
  readonly code = 'DDL_ERROR' as const;
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DdlError';
  }
}

export const PersistenceErrorCodeSchema = z.enum([
  'CONNECTION_FAILED',
  'TIMEOUT',
  'CONSTRAINT_VIOLATION',
  'DEADLOCK',
  'PERMISSION_DENIED',
  'UNKNOWN',
]);
