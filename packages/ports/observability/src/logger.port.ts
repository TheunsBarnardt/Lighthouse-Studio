import type { LogContext } from './types.js';

export interface LoggerPort {
  trace(msg: string, ctx?: LogContext): void;
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
  fatal(msg: string, ctx?: LogContext): void;

  /** Returns a child logger with the given context permanently bound. */
  child(ctx: LogContext): LoggerPort;
}
