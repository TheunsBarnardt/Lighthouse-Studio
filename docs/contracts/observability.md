# Contract: Observability

> Ports: `@platform/ports-observability` — `LoggerPort`, `MetricsPort`, `TracerPort`

## Purpose

Three complementary ports that together provide the observability surface for the platform:

- `LoggerPort` — structured, levelled log output. Every service and adapter uses this instead of `console.log`.
- `MetricsPort` — counters, gauges, histograms, and timing measurements. Surfaces operational signals to dashboards and alerting.
- `TracerPort` — distributed trace spans. Correlates work across service boundaries and async hops.

All three ports share the same design contract: **synchronous, infallible, fire-and-forget**. They never return errors to the caller. The in-memory adapters (NoopLogger, NoopMetrics, NoopTracer) discard all data silently, making them safe defaults in tests and development without requiring any configuration.

Production adapters are defined in Objective 3 (Observability Foundation): pino for logging, Prometheus or StatsD for metrics, OpenTelemetry for tracing.

---

## Methods

### `LoggerPort`

#### `debug(message, context?): void`

Emits a DEBUG-level log line.

**Pre-conditions:** `message` is non-empty. `context` values must be JSON-serialisable; non-serialisable values (circular refs, functions) are silently coerced or dropped by the adapter.

**Post-conditions:** Line is written to the configured sink. Returns immediately; never throws. If the sink is unavailable, the failure is swallowed by the adapter.

---

#### `info(message, context?): void`

Emits an INFO-level log line. Use for significant application events: service started, request received, job completed.

**Pre-conditions / Post-conditions:** Same as `debug`.

---

#### `warn(message, context?): void`

Emits a WARN-level log line. Use for recoverable anomalies: retries, degraded mode, unexpected but handled states.

**Pre-conditions / Post-conditions:** Same as `debug`.

---

#### `error(message, error?, context?): void`

Emits an ERROR-level log line. The `error` parameter accepts any value (typically an `Error` instance or an `AppError`); the adapter serialises it to include `message`, `stack`, and any custom fields.

**Pre-conditions:** `message` is non-empty. `error` may be `null` or `undefined` when logging an error condition that has no associated exception.

**Post-conditions:** Same as `debug`. The adapter must not re-throw `error`.

---

#### `child(bindings): LoggerPort`

Returns a new `LoggerPort` instance that automatically includes `bindings` in every log line it emits. The original logger is unchanged.

**Pre-conditions:** `bindings` is a non-empty object with JSON-serialisable values.

**Post-conditions:**

- Every method called on the child logger includes `bindings` merged into the log line's context.
- The child logger is itself a full `LoggerPort`; further `.child()` calls are valid and merge bindings additively.
- Bindings set on a child do not propagate to the parent or sibling loggers.

**Required usage pattern:** Call `logger.child({ requestId, workspaceId })` at every service boundary (request handler, job handler, event handler) and pass the child logger into the call chain. Do not thread the root logger through request-scoped code.

---

### `MetricsPort`

All methods are synchronous, void, and never throw.

#### `increment(metric, tags?): void`

Increments a counter by 1. Use for event counts: requests, errors, jobs enqueued.

**Naming convention:** `snake_case` dot-separated namespaces, e.g. `workspace.invite.sent`, `job.email.failed`. Tags are `Record<string, string>` — tag values must be low-cardinality (avoid user IDs or resource IDs as tag values; use them in log context instead).

---

#### `gauge(metric, value, tags?): void`

Sets a gauge to an absolute value. Use for point-in-time measurements: connection pool size, queue depth, cache hit count.

---

#### `histogram(metric, value, tags?): void`

Records a single observation into a histogram. Use for distributions: payload sizes, result counts, retry counts.

---

#### `timing(metric, durationMs, tags?): void`

Records a duration in milliseconds. Semantically equivalent to `histogram` but signals to the adapter that the value is a timing measurement, enabling automatic percentile computation in supported backends.

---

### `TracerPort`

#### `startSpan(name, opts?): Span`

Creates and starts a new trace span. The span is active from the moment `startSpan` returns; it does not automatically propagate as the "current" span — the caller holds the reference and must call `.end()` explicitly.

**Pre-conditions:** `name` is a non-empty, human-readable operation descriptor (e.g., `'workspace.create'`, `'db.query.users'`).

**Post-conditions:** Returns a `Span`. The span has started. Parent linkage is set from `opts.parentSpan` if provided; otherwise the span is a root span (or linked to the ambient context by the adapter, if supported).

---

### `Span`

#### `setAttribute(key, value): void`

Attaches a key-value attribute to the span. Attributes are visible in trace UIs and can be used for filtering.

**Conventions:** Key names follow OpenTelemetry semantic conventions where applicable (`db.system`, `http.method`, `workspace.id`). Attribute values must be `string | number | boolean`.

---

#### `setStatus(status, message?): void`

Sets the span's outcome to `'ok'` or `'error'`. Defaults to `'ok'` if never called.

**Post-conditions:** A span with `status: 'error'` is highlighted in trace UIs. `message` is attached as a status description.

---

#### `recordException(error): void`

Attaches an exception event to the span. The adapter serialises the error's type, message, and stack trace.

**Pre-conditions:** `error` may be any value; the adapter handles non-Error values gracefully.

**Post-conditions:** The exception is visible as a span event in trace UIs. Does not alter span status — call `setStatus('error')` separately if the operation failed.

---

#### `end(): void`

Ends the span and flushes it to the configured exporter. Must be called exactly once. Failing to call `end()` causes the span to be dropped by most exporters.

**Pattern for safe span lifecycle:**

```typescript
const span = tracer.startSpan('my.operation');
try {
  // ... do work ...
  span.setStatus('ok');
} catch (e) {
  span.recordException(e);
  span.setStatus('error', 'Unexpected exception');
  throw e;
} finally {
  span.end();
}
```

---

## Capability Flags

| Flag                              | Meaning                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `observability.structuredLogging` | Logger adapter emits JSON (pino); plain-text adapters do not                   |
| `observability.metricsEnabled`    | MetricsPort is wired to a real backend (not Noop)                              |
| `observability.tracingEnabled`    | TracerPort is wired to a real exporter (not Noop)                              |
| `observability.logLevel`          | Effective minimum log level; lines below this level are dropped by the adapter |

---

## Performance Expectations

All three ports are designed to be called on hot paths without measurable overhead in the Noop adapters. Production adapter overhead:

| Operation                              | Expected overhead                                    |
| -------------------------------------- | ---------------------------------------------------- |
| `logger.info` (pino, synchronous sink) | < 1 µs per call (pino is the fastest Node.js logger) |
| `metrics.increment` (StatsD UDP)       | < 1 µs per call (fire-and-forget UDP)                |
| `tracer.startSpan` / `span.end` (OTEL) | < 5 µs per call in non-sampling mode                 |

None of these operations should be debounced, batched by the caller, or placed behind feature flags in hot paths. The adapters handle batching internally.

---

## Known Adapter Divergences

| Behaviour               | Noop (in-memory)    | pino (production)         | StatsD/Prometheus           | OpenTelemetry                  |
| ----------------------- | ------------------- | ------------------------- | --------------------------- | ------------------------------ |
| Output                  | Discarded           | stdout JSON / file        | UDP / HTTP scrape           | OTLP exporter                  |
| `child()`               | Returns same Noop   | Returns pino child        | Returns child with bindings | Context propagation            |
| `histogram` vs `timing` | Identical (no-op)   | Identical                 | StatsD: different suffixes  | Identical                      |
| Exception serialisation | No-op               | Stack in JSON field       | N/A                         | OTel exception event           |
| Minimum log level       | None (discards all) | Configurable at startup   | N/A                         | N/A                            |
| Async flush on shutdown | Not needed          | `logger.flush()` required | Flush UDP socket            | `provider.shutdown()` required |

On process shutdown, production adapters may require explicit flush calls. Wire these into the platform's shutdown lifecycle (Objective 9).

---

## Usage Examples

```typescript
// At service initialisation — create a child logger bound to this service
class WorkspaceService {
  private log: LoggerPort;

  constructor(deps: { logger: LoggerPort; metrics: MetricsPort; tracer: TracerPort }) {
    this.log = deps.logger.child({ service: 'WorkspaceService' });
    this.metrics = deps.metrics;
    this.tracer = deps.tracer;
  }

  async create(input: CreateWorkspaceInput, ctx: RequestContext): Promise<Result<Workspace, AppError>> {
    // Per-request child with tracing correlation
    const log = this.log.child({ requestId: ctx.requestId, workspaceId: ctx.workspaceId });
    const span = this.tracer.startSpan('workspace.create', { attributes: { 'actor.id': ctx.actorId } });

    try {
      log.info('Creating workspace', { slug: input.slug });
      this.metrics.increment('workspace.create.attempt');

      const start = Date.now();
      const result = await this.repo.insert(input);
      this.metrics.timing('workspace.create.duration', Date.now() - start);

      if (result.isErr()) {
        log.error('Workspace creation failed', result.error);
        this.metrics.increment('workspace.create.failed');
        span.setStatus('error', result.error.message);
        return err(result.error);
      }

      log.info('Workspace created', { id: result.value.id });
      this.metrics.increment('workspace.create.success');
      span.setStatus('ok');
      return ok(result.value);
    } catch (e) {
      span.recordException(e);
      span.setStatus('error', 'Unexpected exception');
      throw e;
    } finally {
      span.end();
    }
  }
}
```

---

## Common Misuse

**Using `console.log` anywhere in the codebase.** All log output goes through `LoggerPort`. `console.log`, `console.error`, and `console.warn` are forbidden. Linting rules enforce this. The only exception is bootstrap code that runs before the logger is initialised (e.g., reading the config file to determine the log level).

**Passing the root logger into request-scoped code.** The root logger has no `requestId` or `workspaceId` bound to it. Always call `.child({ requestId, workspaceId })` at the boundary and pass the child logger into every function in that call chain.

**Using high-cardinality tag values in metrics.** Tag values like user IDs or resource IDs create metric explosion in Prometheus and cost money in StatsD backends. Move those values to the log context, not metrics tags.

**Forgetting `span.end()`.** Most exporters silently drop spans that are not ended. Always use `try/finally` to ensure `span.end()` is called. Incomplete traces are harder to debug than no traces.

**Calling `logger.error` for expected error paths.** `Result.err` returns are expected control flow (validation failures, not-found, auth denied). Log these at `warn` or `info`. Reserve `error` for genuinely unexpected conditions: adapter failures, internal invariant violations, unhandled exceptions.

**Serialising secrets into log context.** Never include tokens, passwords, API keys, or PII in log context. The adapter does not redact values. Log IDs and workspace identifiers instead of raw secret values.
