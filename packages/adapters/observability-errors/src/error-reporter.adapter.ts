import type { ErrorContext, ErrorReporterPort } from '@platform/ports-observability';

import * as Sentry from '@sentry/node';

/** Error types that represent expected user errors — not system faults. */
const EXPECTED_ERROR_NAMES = new Set([
  'ValidationError',
  'NotFoundError',
  'UnauthorizedError',
  'ForbiddenError',
  'ConflictError',
  'BadRequestError',
]);

export interface SentryErrorReporterOptions {
  /** Sentry / GlitchTip DSN. When undefined, the reporter initializes in no-op mode. */
  dsn?: string;
  environment: string;
  release: string;
  /** Additional tags set on every event. */
  defaultTags?: Record<string, string>;
}

export class SentryErrorReporter implements ErrorReporterPort {
  private readonly enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  report(error: Error, context?: ErrorContext): Promise<string> {
    if (!this.enabled) return Promise.resolve('disabled');

    const eventId = context
      ? Sentry.withScope((scope) => {
          this.applyToScope(scope, context);
          return Sentry.captureException(error);
        })
      : Sentry.captureException(error);

    return Promise.resolve(eventId);
  }

  setContext(context: ErrorContext): void {
    if (!this.enabled) return;
    this.applyToScope(Sentry.getCurrentScope(), context);
  }

  captureMessage(
    msg: string,
    level: 'info' | 'warning' | 'error',
    context?: ErrorContext,
  ): Promise<string> {
    if (!this.enabled) return Promise.resolve('disabled');

    const eventId = context
      ? Sentry.withScope((scope) => {
          this.applyToScope(scope, context);
          return Sentry.captureMessage(msg, level);
        })
      : Sentry.captureMessage(msg, level);

    return Promise.resolve(eventId);
  }

  private applyToScope(scope: Sentry.Scope, context: ErrorContext): void {
    if (context.user) {
      if (context.user.email) {
        scope.setUser({ id: context.user.id, email: context.user.email });
      } else {
        scope.setUser({ id: context.user.id });
      }
    }
    if (context.workspace) scope.setTag('workspace_id', context.workspace.id);
    if (context.project) scope.setTag('project_id', context.project.id);
    if (context.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value);
      }
    }
    if (context.extra) scope.setExtras(context.extra);
    if (context.request) scope.setContext('request', context.request);
  }
}

export function createSentryErrorReporter(opts: SentryErrorReporterOptions): SentryErrorReporter {
  const { dsn, environment, release, defaultTags } = opts;

  if (!dsn) {
    return new SentryErrorReporter(false);
  }

  const initOptions: Sentry.NodeOptions = {
    dsn,
    environment,
    release,
    // Filter out expected user errors — these are not system faults
    beforeSend(event, hint) {
      const error = hint.originalException;
      if (error instanceof Error && EXPECTED_ERROR_NAMES.has(error.name)) {
        return null;
      }
      return event;
    },
    // Strip PII from breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data?.['password']) {
        breadcrumb.data['password'] = '[REDACTED]';
      }
      return breadcrumb;
    },
  };

  Sentry.init(initOptions);

  if (defaultTags) {
    const scope = Sentry.getCurrentScope();
    for (const [key, value] of Object.entries(defaultTags)) {
      scope.setTag(key, value);
    }
  }

  // Attach active trace ID to every error event
  Sentry.addEventProcessor((event) => {
    const traceId = event.contexts?.['trace']?.['trace_id'];
    if (typeof traceId === 'string') {
      event.tags = { ...event.tags, trace_id: traceId };
    }
    return event;
  });

  return new SentryErrorReporter(true);
}
