import type { AnyContext } from '@platform/ports-authorization';
import type { LoggerPort, MetricsPort, TracerPort } from '@platform/ports-observability';

import type { AppError } from '../errors.js';

/**
 * Dependencies for the observable wrapper. Only the logger is required;
 * metrics and tracer are optional and silently skipped when absent.
 */
export interface ObservabilityDeps {
  logger: LoggerPort;
  metrics?: MetricsPort;
  tracer?: TracerPort;
}

type ServiceMethod<TArgs extends [AnyContext, ...unknown[]], TReturn> = (
  ...args: TArgs
) => Promise<TReturn>;

/**
 * Wraps a service method to automatically emit a trace span, structured
 * log entries, and a duration histogram for every call.
 *
 * Usage inside a service class:
 *
 *   readonly create = observable('WorkspaceService', 'create', this.obs, async (ctx, input) => {
 *     // ... method body
 *   });
 *
 * The returned value is the same as the underlying method. The wrapper is
 * transparent to callers. It catches stray throws from the method body and
 * converts them to a logged fatal entry before re-throwing, so unhandled
 * errors are always visible in structured logs.
 */
export function observable<TArgs extends [AnyContext, ...unknown[]], TReturn>(
  serviceName: string,
  methodName: string,
  obs: ObservabilityDeps,
  fn: ServiceMethod<TArgs, TReturn>,
): ServiceMethod<TArgs, TReturn> {
  return async function wrapped(...args: TArgs): Promise<TReturn> {
    const ctx = args[0];
    const correlationId = ctx.correlationId;
    const label = `${serviceName}.${methodName}`;

    const start = performance.now();

    const runWithinSpan = async (): Promise<TReturn> => {
      obs.logger.debug(`${label}.entry`, { correlationId });

      try {
        const result = await fn(...args);
        const durationMs = performance.now() - start;

        // Determine outcome from Result shape without importing neverthrow.
        // Cast to unknown first so the runtime checks below are not narrowed away
        // by a specific TReturn at the call site.
        const resultUnknown = result as unknown;
        const isResultLike =
          resultUnknown !== null &&
          typeof resultUnknown === 'object' &&
          'isOk' in resultUnknown &&
          typeof (resultUnknown as Record<string, unknown>)['isOk'] === 'function';

        let outcome = 'success';
        let errorCode: string | undefined;

        if (isResultLike) {
          const resultAny = result as unknown as {
            isOk: () => boolean;
            isErr: () => boolean;
            error: AppError;
          };
          if (resultAny.isErr()) {
            outcome = 'error';
            errorCode = resultAny.error.code;
            const isExpected =
              errorCode === 'VALIDATION' ||
              errorCode === 'FORBIDDEN' ||
              errorCode === 'AUTHORIZATION' ||
              errorCode === 'NOT_FOUND';

            if (isExpected) {
              obs.logger.info(`${label}.expected_error`, { correlationId, errorCode });
            } else {
              obs.logger.error(`${label}.error`, { correlationId, errorCode });
            }
          } else {
            obs.logger.debug(`${label}.success`, { correlationId });
          }
        } else {
          obs.logger.debug(`${label}.success`, { correlationId });
        }

        obs.metrics
          ?.histogram('platform_service_method_duration_ms', {
            description: 'Service method call duration in milliseconds',
            unit: 'ms',
          })
          .record(durationMs, { service: serviceName, method: methodName, outcome });

        return result;
      } catch (thrown: unknown) {
        const durationMs = performance.now() - start;
        obs.logger.fatal(`${label}.unhandled`, { correlationId, err: thrown });
        obs.metrics
          ?.histogram('platform_service_method_duration_ms', {
            description: 'Service method call duration in milliseconds',
            unit: 'ms',
          })
          .record(durationMs, { service: serviceName, method: methodName, outcome: 'thrown' });
        throw thrown;
      }
    };

    if (obs.tracer) {
      return obs.tracer.withSpan(label, () => runWithinSpan());
    }

    return runWithinSpan();
  };
}
