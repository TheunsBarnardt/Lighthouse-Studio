import type { ErrorContext, ErrorReporterPort } from '@platform/ports-observability';

export class NoopErrorReporter implements ErrorReporterPort {
  report(_error: Error, _context?: ErrorContext): Promise<string> {
    return Promise.resolve('noop-event-id');
  }

  setContext(_context: ErrorContext): void {}

  captureMessage(
    _msg: string,
    _level: 'info' | 'warning' | 'error',
    _context?: ErrorContext,
  ): Promise<string> {
    return Promise.resolve('noop-event-id');
  }
}
