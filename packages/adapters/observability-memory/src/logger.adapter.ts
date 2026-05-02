import type { LoggerPort, LogLevel } from '@platform/ports-observability';

export class NoopLogger implements LoggerPort {
  debug(_message: string, _context?: Record<string, unknown>): void {}
  info(_message: string, _context?: Record<string, unknown>): void {}
  warn(_message: string, _context?: Record<string, unknown>): void {}
  error(_message: string, _error?: Error, _context?: Record<string, unknown>): void {}
  fatal(_message: string, _error?: Error, _context?: Record<string, unknown>): void {}
  child(_bindings: Record<string, unknown>): LoggerPort {
    return new NoopLogger();
  }
  setLevel(_level: LogLevel): void {}
}
