/**
 * Production composition root. Uses real adapters driven by environment variables.
 *
 * Call initTelemetry() BEFORE calling this function (i.e., before any imports
 * that register OTel auto-instrumentations).
 */

import { createSentryErrorReporter } from '@platform/adapter-observability-errors';
import { createPinoLogger } from '@platform/adapter-observability-logger';
import {
  NoopErrorReporter,
  NoopLogger,
  NoopMetrics,
  NoopTracer,
} from '@platform/adapter-observability-memory';
import { createOtelMetrics } from '@platform/adapter-observability-metrics';
import { createOtelTracer } from '@platform/adapter-observability-tracer';
import { getEnv } from '@platform/config';

import type { PlatformContainer } from './container.js';

/**
 * Creates the production observability bundle from environment variables.
 * Returns adapters ready to inject into the container.
 *
 * When OBS_ENABLED=false, all adapters are no-ops (local dev without the
 * observability stack running, or test environments).
 */
export function createObservabilityBundle(): Pick<
  PlatformContainer,
  'logger' | 'metrics' | 'tracer' | 'errorReporter'
> {
  const env = getEnv();

  if (!env.OBS_ENABLED) {
    return {
      logger: new NoopLogger(),
      metrics: new NoopMetrics(),
      tracer: new NoopTracer(),
      errorReporter: new NoopErrorReporter(),
    };
  }

  const otlpEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const serviceName = env.SERVICE_NAME;
  const serviceVersion = env.SERVICE_VERSION;
  const appEnv = env.APP_ENV;
  const logLevel = env.LOG_LEVEL;
  const logPretty = env.LOG_PRETTY;

  const otlpOpts = otlpEndpoint !== undefined ? { otlpEndpoint } : {};

  return {
    logger: createPinoLogger({
      level: logLevel,
      pretty: logPretty,
      serviceName,
      serviceVersion,
      env: appEnv,
    }),
    metrics: createOtelMetrics({ ...otlpOpts, serviceName, serviceVersion, env: appEnv }),
    tracer: createOtelTracer({ ...otlpOpts, serviceName, serviceVersion, env: appEnv }),
    errorReporter: createSentryErrorReporter({
      ...(env.SENTRY_DSN !== undefined && { dsn: env.SENTRY_DSN }),
      environment: appEnv,
      release: serviceVersion,
    }),
  };
}
