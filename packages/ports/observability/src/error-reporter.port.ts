import type { ErrorContext } from './types.js';

export interface ErrorReporterPort {
  /** Report an error with full context. Returns the event ID for correlation. */
  report(error: Error, context?: ErrorContext): Promise<string>;

  /** Set persistent context for the current scope (user, workspace, etc). */
  setContext(context: ErrorContext): void;

  /** Capture a message (non-error event of interest). */
  captureMessage(
    msg: string,
    level: 'info' | 'warning' | 'error',
    context?: ErrorContext,
  ): Promise<string>;
}

export type { ErrorContext };
