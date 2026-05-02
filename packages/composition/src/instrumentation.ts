/**
 * OTel SDK initialization — MUST be imported before any other application module.
 *
 * For Next.js: place `import '@platform/composition/instrumentation'` in the root
 * `instrumentation.ts` file (register() export).
 *
 * For worker/Node.js processes: import this file as the very first line of the
 * entry point, before any service or library import.
 *
 * This file intentionally has no side effects when OBS_ENABLED is false.
 */

import { createOtelMetrics } from '@platform/adapter-observability-metrics';
import { createOtelTracer } from '@platform/adapter-observability-tracer';
import { getEnv } from '@platform/config';

export interface TelemetryHandles {
  shutdown(): Promise<void>;
}

let initialized = false;

export function initTelemetry(): TelemetryHandles {
  if (initialized) {
    return { shutdown: () => Promise.resolve() };
  }

  const env = getEnv();
  const obsEnabled = env.OBS_ENABLED;

  if (!obsEnabled) {
    initialized = true;
    return { shutdown: () => Promise.resolve() };
  }

  const otlpEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const serviceName = env.SERVICE_NAME;
  const serviceVersion = env.SERVICE_VERSION;
  const appEnv = env.APP_ENV;

  const otlpOpts = otlpEndpoint !== undefined ? { otlpEndpoint } : {};

  // Tracer MUST be initialized before metrics (tracer registers the context manager globally).
  const tracer = createOtelTracer({ ...otlpOpts, serviceName, serviceVersion, env: appEnv });
  const metrics = createOtelMetrics({ ...otlpOpts, serviceName, serviceVersion, env: appEnv });

  initialized = true;

  return {
    async shutdown() {
      await metrics.shutdown();
      void tracer;
    },
  };
}
