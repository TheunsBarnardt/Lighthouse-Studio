import type { LogContext, LoggerPort } from '@platform/ports-observability';

export class NoopLogger implements LoggerPort {
  trace(_msg: string, _ctx?: LogContext): void {}
  debug(_msg: string, _ctx?: LogContext): void {}
  info(_msg: string, _ctx?: LogContext): void {}
  warn(_msg: string, _ctx?: LogContext): void {}
  error(_msg: string, _ctx?: LogContext): void {}
  fatal(_msg: string, _ctx?: LogContext): void {}
  child(_ctx: LogContext): LoggerPort {
    return new NoopLogger();
  }
}
