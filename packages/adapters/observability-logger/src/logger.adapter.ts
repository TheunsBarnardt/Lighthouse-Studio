import type { LogContext, LoggerPort } from '@platform/ports-observability';

import pino from 'pino';

/** Keys that must never appear in log output — pino redacts these paths. */
const REDACT_PATHS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'apiKey',
  'api_key',
  '*.password',
  '*.token',
  '*.secret',
  '*.authorization',
  '*.cookie',
  '*.apiKey',
  '*.api_key',
  'req.headers.authorization',
  'req.headers.cookie',
];

export interface PinoLoggerOptions {
  /** Minimum log level to emit. */
  level: string;
  /** Pretty-print to stdout (dev only). */
  pretty?: boolean;
  /** Service name for log enrichment. */
  serviceName: string;
  /** Service version for log enrichment. */
  serviceVersion: string;
  /** Deployment environment. */
  env: string;
}

export class PinoLogger implements LoggerPort {
  private readonly instance: pino.Logger;

  constructor(instance: pino.Logger) {
    this.instance = instance;
  }

  trace(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.instance.trace(ctx, msg);
    } else {
      this.instance.trace(msg);
    }
  }

  debug(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.instance.debug(ctx, msg);
    } else {
      this.instance.debug(msg);
    }
  }

  info(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.instance.info(ctx, msg);
    } else {
      this.instance.info(msg);
    }
  }

  warn(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.instance.warn(ctx, msg);
    } else {
      this.instance.warn(msg);
    }
  }

  error(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.instance.error(ctx, msg);
    } else {
      this.instance.error(msg);
    }
  }

  fatal(msg: string, ctx?: LogContext): void {
    if (ctx) {
      this.instance.fatal(ctx, msg);
    } else {
      this.instance.fatal(msg);
    }
  }

  child(ctx: LogContext): LoggerPort {
    return new PinoLogger(this.instance.child(ctx));
  }
}

export function createPinoLogger(opts: PinoLoggerOptions): PinoLogger {
  const { level, pretty = false, serviceName, serviceVersion, env } = opts;

  const baseOptions: pino.LoggerOptions = {
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
    base: {
      service: serviceName,
      version: serviceVersion,
      env,
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (pretty) {
    const transport = pino.transport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    }) as Parameters<typeof pino>[1];
    return new PinoLogger(pino(baseOptions, transport));
  }

  return new PinoLogger(pino(baseOptions));
}
