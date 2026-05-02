# Objective 3: Observability Foundation

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, and 2 complete
**Blocks:** Every objective from this point forward — no feature code is written before observability infrastructure exists

---

## 1. Purpose

Establish the structured logging, metrics, distributed tracing, and error tracking infrastructure such that every line of code written from this point forward emits useful signals. Build the receiving infrastructure (collectors, dashboards, alerting) before any feature code so observability is never an afterthought.

The platform must be debuggable in production by reading logs, traces, and metrics — not by guessing, not by SSH, not by attaching a debugger. When something fails at 3am, the on-call (you) must be able to answer "what happened, when, to whom, and why" within minutes.

This objective produces no user-visible features. It produces the senses the platform uses to perceive itself.

---

## 2. Scope

### In Scope

- Structured logging with correlation IDs, emitted as JSON to stdout
- Logger port (already declared in Objective 1.5) and adapter implementations
- Metrics: counters, gauges, histograms via OpenTelemetry
- Distributed tracing across web → database → worker via OpenTelemetry
- Error tracking with stack traces and full request context
- Self-hosted observability stack (Grafana + Loki + Tempo + Prometheus + GlitchTip)
- Receiving infrastructure deployed via Coolify alongside the platform
- Dashboards for foundation services (must exist before features ship)
- Alerting rules and escalation channels
- Performance budgets and SLO definitions
- Trace sampling strategy
- Log retention policy
- Integration into CI: every PR must include observability for new code paths
- ADRs documenting choices

### Out of Scope (Belongs to Later Objectives)

- Application-level metrics specific to features (added in each feature objective)
- Business metrics dashboards (added when features generate them)
- User-facing analytics (separate objective; user analytics is different from system observability)
- Synthetic monitoring / uptime checks from external locations (Objective 17)
- Compliance audit log (separate from observability — Objective 7)

---

## 3. Locked Decisions

| Decision           | Choice                                                                                        | Rationale                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Telemetry standard | OpenTelemetry (OTel)                                                                          | Vendor-neutral; future-proof; switch backends without rewriting instrumentation |
| Log shipping       | OTel SDK → OTel Collector → Loki                                                              | Standard pipeline; lets us swap Loki later if needed                            |
| Metrics backend    | Prometheus (scraped by Grafana Agent / OTel Collector)                                        | Industry standard; mature; self-hostable                                        |
| Trace backend      | Tempo                                                                                         | Pairs with Grafana; cheap to self-host; supports OpenTelemetry natively         |
| Log backend        | Loki                                                                                          | Cheap to self-host; integrated with Grafana                                     |
| Visualization      | Grafana                                                                                       | Industry standard; free; self-hostable                                          |
| Error tracking     | GlitchTip (Sentry-compatible, self-hosted)                                                    | Free; uses Sentry SDKs; fully self-hosted (data sovereignty)                    |
| Logger library     | Pino                                                                                          | Fast, JSON-native, ergonomic API                                                |
| OTel for Node      | `@opentelemetry/api` + auto-instrumentations + manual spans                                   | Standard SDK                                                                    |
| OTel for Next.js   | Vercel's OpenTelemetry support is removed; use OTel SDK directly via `instrumentation.ts`     | Works without Vercel                                                            |
| Sampling           | Tail-based sampling at the Collector for traces; head-based for hot paths                     | Catch errors and slow traces; reduce volume on healthy traffic                  |
| Log levels         | trace, debug, info, warn, error, fatal                                                        | Standard levels                                                                 |
| Default log level  | info in prod, debug in staging, debug in dev                                                  | Pragmatic                                                                       |
| Correlation ID     | UUID v7 (time-ordered) propagated as `x-correlation-id` HTTP header and `traceparent` per W3C | Time-ordered IDs make log scanning much faster                                  |
| Log retention      | 14 days hot, 90 days cold (compressed in object storage)                                      | Balances forensic value with storage cost                                       |
| Trace retention    | 7 days                                                                                        | Traces are voluminous; recent traces are most valuable                          |
| Metrics retention  | 15 days raw, 1 year downsampled                                                               | Standard Prometheus retention pattern                                           |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                       PLATFORM SERVICES                               │
│                                                                       │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│   │   web app   │    │   worker    │    │  data svc   │              │
│   │ Pino + OTel │    │ Pino + OTel │    │ Pino + OTel │              │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘              │
│          │                  │                  │                      │
│          └─────────┬────────┴────────┬─────────┘                      │
│                    │                 │                                │
│         JSON logs (stdout)   OTLP traces+metrics                      │
│                    │                 │                                │
└────────────────────┼─────────────────┼────────────────────────────────┘
                     │                 │
                     ▼                 ▼
        ┌────────────────────────────────────────────┐
        │      OTel Collector (alloy or otelcol)     │
        │  - receives logs, metrics, traces          │
        │  - tail-sample traces                      │
        │  - enrich (env, service, version)          │
        │  - route to backends                       │
        └────────┬──────────────┬──────────────┬─────┘
                 │              │              │
                 ▼              ▼              ▼
          ┌──────────┐    ┌──────────┐   ┌──────────┐
          │   Loki   │    │ Prometheus│   │  Tempo   │
          │  (logs)  │    │ (metrics) │   │ (traces) │
          └─────┬────┘    └─────┬─────┘   └─────┬────┘
                │               │               │
                └───────────────┴───────────────┘
                                │
                                ▼
                         ┌──────────────┐
                         │   Grafana    │
                         │ (dashboards, │
                         │   queries,   │
                         │  alerting)   │
                         └──────────────┘

   ┌──────────────────────────────────────────────────┐
   │           ERROR TRACKING (separate path)          │
   │                                                   │
   │   Apps ──────► Sentry SDK ──────► GlitchTip ──┐  │
   │                                                │  │
   │                                                ▼  │
   │                                       Web UI      │
   │                                       Alerts      │
   └──────────────────────────────────────────────────┘
```

The full stack runs as Docker containers, deployed via Coolify alongside the platform itself. On the reference deployment (single Afrihost VPS), this adds roughly 1–2 GB RAM overhead. On the 8 GB baseline, this is comfortable. On the 4 GB floor, the stack is trimmed (drop Tempo, keep logs and metrics only) — documented as a constraint.

---

## 5. Component Specifications

### 5.1 Logger Adapter (`packages/adapters/observability-logger`)

Implements `LoggerPort` (defined as a stub in Objective 1.5). Pino-backed.

```typescript
// packages/ports/observability/src/logger.port.ts
export interface LoggerPort {
  trace(msg: string, ctx?: LogContext): void;
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
  fatal(msg: string, ctx?: LogContext): void;

  /** Returns a child logger with bound context. */
  child(ctx: LogContext): LoggerPort;
}

export interface LogContext {
  [key: string]: unknown;
  // Reserved keys used by the logging infrastructure:
  // correlationId, traceId, spanId, userId, workspaceId, projectId
}
```

The Pino adapter:

- Outputs JSON to stdout (Docker captures it)
- Auto-injects `correlationId`, `traceId`, `spanId`, `service`, `env`, `version` from the active OTel context
- Redacts known-sensitive keys (`password`, `token`, `secret`, `authorization`, `cookie`, `apiKey`) using Pino's redact feature
- Pretty-prints in development only (controlled by `LOG_PRETTY` env var)
- Uses `pino.transport()` for async log shipping to the OTel Collector via OTLP HTTP

**Key behaviors:**

- The logger never throws. A failed write is logged once at `fatal` level to stderr; the process keeps running.
- Child loggers inherit context. When code adds `workspaceId` to a child, every log line from that child includes it.
- The logger never logs `Error` objects directly — it serializes them via Pino's standard error serializer (message, stack, code, cause).
- `LogContext` values are JSON-serializable; non-serializable values are coerced or dropped with a warning.

### 5.2 Metrics Adapter (`packages/adapters/observability-metrics`)

Implements `MetricsPort`. OpenTelemetry-backed.

```typescript
// packages/ports/observability/src/metrics.port.ts
export interface MetricsPort {
  counter(name: string, opts?: MetricOptions): Counter;
  gauge(name: string, opts?: MetricOptions): Gauge;
  histogram(name: string, opts?: HistogramOptions): Histogram;
}

export interface Counter {
  add(value: number, attributes?: MetricAttributes): void;
}

export interface Gauge {
  set(value: number, attributes?: MetricAttributes): void;
}

export interface Histogram {
  record(value: number, attributes?: MetricAttributes): void;
}

export interface MetricOptions {
  description?: string;
  unit?: string;
}

export interface HistogramOptions extends MetricOptions {
  boundaries?: number[];
}

export type MetricAttributes = Record<string, string | number | boolean>;
```

**Naming convention:**

- All metric names use snake_case
- Prefix with the area: `platform_persistence_`, `platform_ai_`, `platform_jobs_`, `platform_http_`
- Suffix with the unit where ambiguous: `_seconds`, `_bytes`, `_count`, `_total`
- Counters always end in `_total` (Prometheus convention)
- Histograms for durations end in `_seconds`

**Required platform metrics (created in this objective, populated by later objectives):**

- `platform_http_requests_total{method, route, status}` — counter
- `platform_http_request_duration_seconds{method, route, status}` — histogram
- `platform_persistence_query_duration_seconds{adapter, operation, entity}` — histogram
- `platform_jobs_executed_total{stage, status}` — counter
- `platform_jobs_duration_seconds{stage, status}` — histogram
- `platform_ai_calls_total{provider, model, status}` — counter
- `platform_ai_call_duration_seconds{provider, model, status}` — histogram
- `platform_ai_tokens_total{provider, model, type}` — counter (type = input/output)
- `platform_active_users` — gauge
- `platform_active_workspaces` — gauge
- Service-level: `process_*` from `@opentelemetry/instrumentation-runtime-node`

### 5.3 Tracer Adapter (`packages/adapters/observability-tracer`)

Implements `TracerPort`. OpenTelemetry-backed.

```typescript
// packages/ports/observability/src/tracer.port.ts
export interface TracerPort {
  /** Run a function within a new span. The span is automatically ended when the function returns. */
  withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T, opts?: SpanOptions): Promise<T>;

  /** Get the current active span (for adding attributes to it). */
  currentSpan(): Span | undefined;

  /** Extract trace context from incoming headers. */
  extract(headers: Record<string, string>): TraceContext | undefined;

  /** Inject trace context into outgoing headers. */
  inject(headers: Record<string, string>): void;
}

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setAttributes(attrs: Record<string, string | number | boolean>): void;
  recordException(error: Error): void;
  setStatus(status: 'ok' | 'error', message?: string): void;
}
```

**Auto-instrumented:**

- HTTP server (Next.js / Node http) — incoming requests get spans
- HTTP client (fetch, undici) — outgoing requests get spans
- Database drivers (pg, mssql, mongodb) — queries get spans (driver-specific instrumentations)
- pnpm/process metrics

**Manually instrumented:**

- Service-layer functions in `packages/core` (every public method on a service gets a span)
- AI generation calls
- Job execution
- Queue operations

**Span naming:**

- HTTP server: `HTTP <METHOD> <route>` (e.g., `HTTP GET /api/projects/:id`)
- Database: `db.<operation> <entity>` (e.g., `db.findById Project`)
- AI: `ai.<operation>` (e.g., `ai.generate`)
- Service: `<ServiceName>.<methodName>` (e.g., `ProjectService.create`)

**Context propagation:**

- W3C Trace Context headers (`traceparent`, `tracestate`) flow across all HTTP boundaries
- Worker picks up `traceparent` from job records (the job record stores the trace ID at enqueue time)
- Database calls inherit context via active span (no explicit propagation needed)

### 5.4 Error Tracking Adapter (`packages/adapters/observability-errors`)

Implements an `ErrorReporterPort` (added in this objective; not in Objective 1.5's original list — minor amendment).

```typescript
export interface ErrorReporterPort {
  /** Report an error with full context. Returns the event ID for correlation. */
  report(error: Error, context?: ErrorContext): Promise<string>;

  /** Set persistent context for the current scope (user, workspace, etc). */
  setContext(context: ErrorContext): void;

  /** Capture a message (non-error event of interest). */
  captureMessage(msg: string, level: 'info' | 'warning' | 'error', context?: ErrorContext): Promise<string>;
}

export interface ErrorContext {
  user?: { id: string; email?: string };
  workspace?: { id: string };
  project?: { id: string };
  request?: { method: string; url: string; headers?: Record<string, string> };
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}
```

The GlitchTip/Sentry adapter:

- Uses the official Sentry Node SDK (Sentry-compatible; works with GlitchTip)
- Captures unhandled exceptions via `process.on('unhandledRejection')` and `process.on('uncaughtException')` — but never silences them; logs and exits as appropriate
- Auto-attaches the current trace ID to every error (so errors link to traces)
- Filters out expected errors (e.g., `ValidationError`, `NotFoundError` from `@platform/shared`) by default — these are user errors, not system errors
- Strips PII via the Sentry SDK's `beforeSend` hook

### 5.5 Composition: Wiring Telemetry First

In `packages/composition/src/compose.ts`, observability is initialized **before** any other service.

```typescript
export async function compose(): Promise<PlatformContainer> {
  // 1. Telemetry first — everything else needs to log
  const tracer = await initTracer();
  const metrics = await initMetrics();
  const logger = await initLogger();
  const errorReporter = await initErrorReporter();

  // 2. Now we can log the rest of composition
  logger.info('composition: starting');

  // 3. Wire the rest of the container...
  const persistence = await initPersistence(logger, tracer);
  // etc.

  return {
    /* ... */
  };
}
```

The OTel SDK is initialized in a separate file `packages/composition/src/instrumentation.ts` that runs **before** any application module is imported. For Next.js, this means using the `instrumentation.ts` hook at the project root.

### 5.6 OTel Collector

Deployed as a service in the dev Docker Compose stack and the (designed) staging/prod stacks.

**Configuration: `deploy/observability/otel-collector.yaml`**

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    timeout: 5s
  resource:
    attributes:
      - key: deployment.environment
        from_attribute: env
        action: upsert

  # Tail-based sampling: keep all error traces, sample healthy ones
  tail_sampling:
    decision_wait: 30s
    policies:
      - name: errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      - name: slow
        type: latency
        latency: { threshold_ms: 1000 }
      - name: random
        type: probabilistic
        probabilistic: { sampling_percentage: 10 }

exporters:
  loki:
    endpoint: http://loki:3100/loki/api/v1/push
  prometheusremotewrite:
    endpoint: http://prometheus:9090/api/v1/write
  otlp/tempo:
    endpoint: tempo:4317
    tls: { insecure: true }

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [loki]
    metrics:
      receivers: [otlp]
      processors: [batch, resource]
      exporters: [prometheusremotewrite]
    traces:
      receivers: [otlp]
      processors: [tail_sampling, batch, resource]
      exporters: [otlp/tempo]
```

This Collector is the single point of telemetry ingestion. If we ever swap Loki for Elasticsearch or Tempo for Jaeger, only the Collector config changes; application code stays the same.

### 5.7 Loki, Prometheus, Tempo, Grafana Deployment

Each runs as a containerized service in the observability stack.

**`deploy/observability/compose.yml`:**

- `loki:3100` — log storage
- `prometheus:9090` — metrics storage
- `tempo:3200` — trace storage
- `grafana:3000` — UI (mapped to 3001 to avoid conflict with web app)
- `otel-collector:4317/4318` — telemetry ingest
- `glitchtip:8000` — error tracking UI

Persistent volumes for each:

- `loki-data`, `prometheus-data`, `tempo-data`, `grafana-data`, `glitchtip-postgres-data`

**Resource limits per container** (tuned for 8 GB host running platform + observability):

- Grafana: 256 MB
- Prometheus: 512 MB
- Loki: 512 MB
- Tempo: 512 MB
- OTel Collector: 256 MB
- GlitchTip: 512 MB
- Total observability footprint: ~2.5 GB

For the 4 GB host floor, document a "minimal" mode that drops Tempo and runs Loki + Grafana + GlitchTip only (~1.5 GB).

### 5.8 Grafana Provisioning

Grafana datasources, dashboards, and alert rules are provisioned via files in `deploy/observability/grafana/`. No clicking around in the UI; the configuration is in git.

**Datasources** (`provisioning/datasources/datasources.yaml`):

- Loki (logs)
- Prometheus (metrics)
- Tempo (traces)

**Dashboards** (`provisioning/dashboards/`):

- `platform-overview.json` — high-level health
- `platform-http.json` — request rates, latencies, errors
- `platform-persistence.json` — database query performance, connection pool
- `platform-jobs.json` — worker queue depth, job durations, failure rate
- `platform-ai.json` — AI call rates, latencies, token usage, costs
- `platform-resources.json` — CPU, memory, disk per container

These dashboards exist before any feature ships. They're populated as features land.

**Alert rules** (`provisioning/alerting/rules.yaml`):

- HTTP error rate > 5% over 5 minutes
- HTTP p95 latency > 2s over 10 minutes
- Worker queue depth > 100 jobs
- Job failure rate > 10% over 15 minutes
- Database connection pool exhaustion
- Memory usage > 90% on any container for 5 minutes
- Disk usage > 80% on the host
- Any service down for > 1 minute

**Notification channels:**

- Email (always)
- (Optional) Slack webhook
- (Optional) ntfy.sh for mobile push (free, self-hostable, no account needed)

For solo dev, email + ntfy.sh is sufficient. Document upgrade path to Slack/PagerDuty when team grows.

### 5.9 Performance Budgets and SLOs

Defined now, measured from day one.

**SLOs (Service Level Objectives):**

- HTTP availability: 99.5% over 28 days (allows ~3.4 hours downtime per month)
- HTTP p95 latency: < 500ms over 28 days
- Job processing latency p95: < 5 minutes for AI jobs, < 30 seconds for non-AI jobs
- Data correctness: 100% (any data corruption is an SLO miss)

**Performance budgets (per request type):**

- Read-only endpoints: p95 < 200ms, p99 < 500ms
- Write endpoints: p95 < 500ms, p99 < 1s
- AI generation endpoints (start/poll only): p95 < 200ms, p99 < 500ms (the AI work itself runs in the worker, not the request path)

**Error budgets:**

- 99.5% SLO = 0.5% error budget = 14.4 minutes of downtime per 4 weeks
- When error budget is exhausted, no new feature deploys are allowed until the budget recovers

These budgets shape what alerts fire and what is considered an incident.

### 5.10 Trace Sampling

**Head-based sampling** at the SDK level:

- 100% of traces are started (head-based always-on)
- Each span carries a sampling decision

**Tail-based sampling** at the Collector:

- All traces with errors are kept
- All traces > 1 second are kept
- 10% of remaining traces are kept (random sample)

This catches every problem while keeping volume manageable.

### 5.11 Log Retention

**Hot storage (Loki):** 14 days. Indexed, queryable instantly.

**Cold storage:** 90 days. Compressed Parquet files in S3-compatible storage (Backblaze B2 backup target also serves as cold log archive). Loki's `compactor` handles the transition.

**Prod retention:** longer (configurable). Compliance use cases may need years.

**PII in logs:** redacted at write time by the Pino adapter. Audit logs (separate from application logs) are the system of record for who-did-what; not these logs.

### 5.12 CI Integration

Every PR's CI run produces a "telemetry coverage" report:

- Number of new public functions added
- Number of those that have at least one logged event
- Number of those that have a span
- Number of new error throw sites
- Number of those that go through `ErrorReporterPort`

A baseline is set; if a PR drops coverage significantly, CI flags it for human review. This is a soft gate, not a hard fail — observability completeness can't be perfectly measured by static analysis.

A test harness ensures:

- Logger calls produce structured JSON
- Span creation works
- Metric registration works
- Error reporter integration is healthy

These are integration tests run in CI against the actual Pino, OTel, and Sentry SDKs.

### 5.13 Local Development Mode

Local dev runs the observability stack via Docker Compose (optional).

- `pnpm obs:up` — starts the local Grafana/Loki/Tempo/Prometheus/GlitchTip stack
- `pnpm obs:down` — stops it
- Logs from `pnpm dev` are pretty-printed by Pino in a human-readable format AND simultaneously shipped to the local Collector
- Local Grafana is accessible at `http://localhost:3001`

For lightweight dev (laptop, no observability stack running), the platform falls back to console-only logging. Detected via `OBS_ENABLED=false`. The Collector's absence is handled by the OTel SDK gracefully (it queues and retries; eventually drops with a warning).

### 5.14 Operational Runbooks

New files in `docs/runbooks/`:

- `observability-stack.md` — what's running, where it's stored, how to reach the UIs
- `debugging-with-logs.md` — common log queries in Grafana/Loki, how to trace a request end-to-end
- `debugging-with-traces.md` — finding slow requests, looking up errors by trace ID
- `responding-to-alerts.md` — what each alert means, first steps for each
- `slo-management.md` — checking error budgets, what to do when they're exhausted
- `observability-stack-recovery.md` — what to do if the observability stack itself goes down (it shouldn't take the platform with it, but losing visibility is an incident)

### 5.15 What Every Code Path Must Do

Going forward, every code path follows the **observability checklist**:

- [ ] Has a span (manual or auto-instrumented)
- [ ] Logs at info level on success
- [ ] Logs at warn or error level on failure with full context
- [ ] Records relevant metrics (counters for events, histograms for durations)
- [ ] Reports unexpected errors via `ErrorReporterPort`
- [ ] Includes correlation ID and tenant context (workspaceId, userId where applicable)
- [ ] Sensitive data is redacted

A code review template enforces this — no PR adds a feature without these boxes checked.

---

## 6. Implementation Order

1. **Provision the observability stack on the Afrihost server.**

   - Add `deploy/observability/compose.yml` with Grafana, Loki, Tempo, Prometheus, OTel Collector, GlitchTip
   - Wire into Coolify as a separate Resource (the observability stack is platform-agnostic — it could even monitor things outside the platform later)
   - Configure persistent volumes
   - Configure Caddy routing for Grafana and GlitchTip on IP-restricted subdomains (`grafana.<domain>`, `errors.<domain>`)

2. **Implement the LoggerPort.**

   - `packages/ports/observability/src/logger.port.ts` (full interface)
   - `packages/adapters/observability-logger/` (Pino-backed implementation)
   - Conformance tests (basic — formatting, level filtering, redaction)

3. **Implement the MetricsPort.**

   - Port interface
   - Adapter using `@opentelemetry/api` and `@opentelemetry/sdk-metrics`
   - Conformance tests

4. **Implement the TracerPort.**

   - Port interface
   - Adapter using `@opentelemetry/api` and `@opentelemetry/sdk-trace-node`
   - Auto-instrumentations registered: HTTP, fetch, pg/mssql/mongodb (driver-specific)
   - Conformance tests

5. **Implement the ErrorReporterPort.**

   - Add this port to `packages/ports/observability/`
   - Adapter using `@sentry/node` configured for GlitchTip
   - Filter expected errors

6. **Set up the OTel SDK initialization.**

   - `packages/composition/src/instrumentation.ts`
   - Started before any app module imports
   - For Next.js: hooked via `instrumentation.ts` at the project root
   - For the worker: started at the entry point before any service is composed

7. **Provision Grafana with dashboards and alert rules.**

   - All datasources defined in code
   - All dashboards as JSON in repo
   - All alert rules in repo
   - Email + ntfy.sh notification channels configured

8. **Add platform-level metrics.**

   - HTTP middleware records request metrics
   - Database adapters record query metrics
   - AI adapters record call metrics
   - Worker records job metrics

9. **Wire correlation IDs end-to-end.**

   - Middleware in the web app generates / propagates correlation IDs
   - Logger picks up correlation ID from context
   - Trace context flows via W3C headers
   - Worker stores `traceparent` in job records and reconnects on pickup

10. **Wire up error tracking.**

    - Web app: Sentry SDK installed, GlitchTip DSN configured
    - Worker: same
    - PII filtering enabled
    - Trace ID auto-attached to errors

11. **Local dev mode.**

    - `pnpm obs:up` and `pnpm obs:down` scripts
    - Pretty-print logs in dev
    - Fallback to console-only when stack not running

12. **Write all runbooks.**

13. **Write ADRs.**

14. **Verify Definition of Done.**

---

## 7. ADRs to Write

- **ADR-0018: Observability Stack Choice** — Grafana/Loki/Tempo/Prometheus/GlitchTip, why self-hosted, what we give up vs. Datadog
- **ADR-0019: OpenTelemetry as the Standard** — instrument once, swap backends without rewriting
- **ADR-0020: Trace Sampling Strategy** — head-based 100%, tail-based for keeps; rationale and tuning
- **ADR-0021: Log Retention and PII Handling** — what's kept, what's redacted, how long, where
- **ADR-0022: SLO and Error Budget Framework** — initial SLOs, how they're measured, what triggers what
- **ADR-0023: Pino over Bunyan/Winston** — performance, JSON-native, ecosystem

---

## 8. Verification Steps

1. **Observability stack is up.** Grafana, Loki, Tempo, Prometheus, OTel Collector, GlitchTip — all running, all reachable from inside Docker network, IP-restricted from outside.

2. **A log line from the web app appears in Grafana within 10 seconds** of being emitted. Tested by hitting a test endpoint that logs.

3. **A trace appears in Tempo for any HTTP request** within 30 seconds (after tail-sampling decision wait).

4. **A metric increment appears in Prometheus** within 30 seconds.

5. **An unhandled error appears in GlitchTip** within 30 seconds, with stack trace, correlation ID, and trace ID linked.

6. **Correlation ID propagates end-to-end.** Make a request to the web app that triggers a database query, an AI job, and a worker pickup. Search Loki for the correlation ID — every related log line is found.

7. **Log redaction works.** Log a fake password / token / API key. Verify in Loki that they're redacted.

8. **All required platform metrics exist** in Prometheus (`platform_http_*`, `platform_persistence_*`, `platform_jobs_*`, `platform_ai_*`).

9. **All foundation dashboards render** without "no data" panels (after generating sample traffic).

10. **Alert fires.** Trigger one of the alert conditions (e.g., generate 100 5xx responses in 5 minutes). Email and/or ntfy notification arrives.

11. **Tail sampling works.** Generate 100 healthy traces and 5 error traces. After 30s, verify in Tempo that all 5 errors are present and roughly 10 of the healthy ones (10% sample).

12. **Local dev mode works.** Stop the local observability stack. Start the app. Verify pretty-printed logs in console, no crashes from missing collector. Start the stack. Verify logs/traces flow.

13. **Resource usage is within budget.** With observability + dev platform stack running, server RAM usage stays under 6 GB on the 8 GB baseline.

14. **CI telemetry coverage check exists** and reports baseline numbers on every PR.

15. **Service restart doesn't lose data.** Restart Loki container. Verify previously-ingested logs are still queryable. Same for Prometheus and Tempo.

If all 15 pass, the objective is met.

---

## 9. Definition of Done

**Infrastructure**

- [ ] Observability stack deployed on Afrihost server via Coolify
- [ ] All six services up: Grafana, Loki, Tempo, Prometheus, OTel Collector, GlitchTip
- [ ] Persistent volumes configured for all stateful services
- [ ] Caddy IP-restricted routing to Grafana and GlitchTip
- [ ] Resource limits configured per container

**Ports**

- [ ] `LoggerPort` defined with full interface and contract document
- [ ] `MetricsPort` defined with full interface and contract document
- [ ] `TracerPort` defined with full interface and contract document
- [ ] `ErrorReporterPort` defined with full interface and contract document

**Adapters**

- [ ] Pino adapter for `LoggerPort`, with conformance tests
- [ ] OTel adapter for `MetricsPort`, with conformance tests
- [ ] OTel adapter for `TracerPort`, with conformance tests
- [ ] Sentry/GlitchTip adapter for `ErrorReporterPort`

**Initialization**

- [ ] OTel SDK initialized before any app module
- [ ] Web app's `instrumentation.ts` hook configured
- [ ] Worker's entry point initializes telemetry first
- [ ] Composition root logs after telemetry is up

**Grafana**

- [ ] Datasources provisioned via code
- [ ] All foundation dashboards committed and provisioned
- [ ] All foundation alert rules committed and provisioned
- [ ] Email + ntfy notification channels configured
- [ ] No manual configuration of Grafana via UI

**Behaviors**

- [ ] Correlation IDs propagate end-to-end (HTTP → DB → worker → log → trace → error)
- [ ] PII redaction in logs verified
- [ ] Tail-sampling configured and tested
- [ ] All required platform metrics implemented and emitting
- [ ] HTTP middleware records request metrics and creates spans
- [ ] Database adapters create spans for queries
- [ ] Errors auto-link to traces via shared trace ID

**Local Dev**

- [ ] `pnpm obs:up` and `pnpm obs:down` work
- [ ] Pretty-print logs in dev
- [ ] Graceful fallback when collector unreachable

**CI**

- [ ] Telemetry coverage check runs on every PR
- [ ] Integration test for the observability adapters runs in CI

**SLOs**

- [ ] SLOs defined and documented
- [ ] Error budgets defined and documented
- [ ] SLO dashboard exists in Grafana

**Documentation**

- [ ] All runbooks in Section 5.14 written
- [ ] ADRs 0018–0023 written and Accepted
- [ ] CONTRIBUTING.md updated with observability checklist
- [ ] PR template includes observability checkbox

**Verification**

- [ ] All 15 verification steps in Section 8 pass

---

## 10. Anti-Patterns to Refuse

- **`console.log` in committed code.** ESLint rule `no-console` blocks it. Use the logger.
- **Logging Error objects directly.** Use the structured serializer (Pino does this; just `logger.error('msg', { err })`).
- **Adding observability after the fact.** Every PR adds it inline. Retrofitting is theater.
- **Logging passwords, tokens, secrets.** Even temporarily for debugging. Use the redaction list; if the redaction list misses something, add to it.
- **Disabling tail sampling for "completeness."** Storage costs aside, the noise floor drowns the signal. Tail sampling stays on.
- **Configuring Grafana via the UI.** Click-ops disappears on the next container restart. Provision via files.
- **Writing custom log shipping outside OTel.** OTel is the standard. If a tool doesn't speak it, it gets a sidecar that does.
- **Skipping correlation IDs because "it's just one service."** Today it's one. Tomorrow there's a worker, an external job runner, a user reporting a bug. The IDs propagate from day one or they don't propagate at all.
- **Alerting on every metric.** Alert fatigue kills incident response. Alerts only on the SLOs and known critical conditions; everything else is dashboard-only.
- **Treating observability as ops's problem.** It's the developer's problem. The dev who shipped the code knows what should be observable about it.

---

## 11. Open Questions for Confirmation Before Starting

1. **Grafana / GlitchTip subdomains.** Confirming `grafana.<domain>` and `errors.<domain>` work for you, or different naming?

2. **Notification channel.** Email-only fine for now? Adding ntfy.sh is trivial and recommended. Slack later when team grows?

3. **Resource budget.** With the 8 GB baseline (platform ~3 GB, observability ~2.5 GB, OS/Docker ~1 GB), you're at ~6.5 GB used. Comfortable. If you stay on 4 GB initially, we drop Tempo from the stack and lose distributed tracing in exchange for fitting in. Confirm we plan for 8 GB and document the 4 GB minimal mode?

4. **GlitchTip vs. Sentry self-hosted vs. Sentry SaaS.** GlitchTip is far lighter and AGPL-friendly. Sentry self-hosted is heavier (~4 GB RAM alone). Sentry SaaS is paid. Going with GlitchTip unless you object.

5. **Cold log archive.** Push logs older than 14 days to Backblaze B2 (where backups already go) or skip cold archive for now? Cold archive is recommended for compliance use cases later but adds operational complexity. Default: skip until needed.

---

## 12. What Comes Next

With Objective 3 complete, the platform can perceive itself. Every line of code from this point forward is observable from day one — logged, traced, measured, reportable.

**Objective 4 family** comes next: the persistence adapters. Postgres first, since it's the maintainer's stack. MSSQL second. MongoDB third. Each adapter implements the persistence ports defined in Objective 1.5, runs through the same conformance test suite, and is observable through the infrastructure built in Objective 3.

---

_This document is the contract. Every checkbox in Section 9 must be true before moving on._
