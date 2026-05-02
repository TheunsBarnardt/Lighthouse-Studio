export abstract class AppError extends Error {
  abstract readonly code: string;
  readonly statusCode: number;

  constructor(message: string, statusCode: number, options?: { cause?: unknown }) {
    super(message, options as ErrorOptions);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    // V8-specific stack capture; works in Node.js and Chrome
    const ErrorCtor = Error as unknown as {
      captureStackTrace?: (target: object, ctor: new (...args: unknown[]) => unknown) => void;
    };
    ErrorCtor.captureStackTrace?.(this, this.constructor as new (...args: unknown[]) => unknown);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 422, options);
  }
}

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 404, options);
  }
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED';
  constructor(message: string = 'Authentication required', options?: { cause?: unknown }) {
    super(message, 401, options);
  }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  constructor(message: string = 'Insufficient permissions', options?: { cause?: unknown }) {
    super(message, 403, options);
  }
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 409, options);
  }
}

export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 502, options);
  }
}

export class NotSupportedError extends AppError {
  readonly code = 'NOT_SUPPORTED';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 501, options);
  }
}

export class TimeoutError extends AppError {
  readonly code = 'TIMEOUT';
  constructor(message: string = 'Operation timed out', options?: { cause?: unknown }) {
    super(message, 504, options);
  }
}
