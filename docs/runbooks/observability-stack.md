# Runbook: Observability Stack

The platform runs its own observability infrastructure: Grafana, Loki, Tempo, Prometheus, OTel Collector, and GlitchTip. This runbook covers what's running, where things are stored, and how to reach the UIs.

## Services

| Service        | Port                     | Purpose                                      |
| -------------- | ------------------------ | -------------------------------------------- |
| Grafana        | 3001                     | Dashboards, alerts, log/trace/metric queries |
| Loki           | 3100                     | Log storage (LogQL)                          |
| Tempo          | 3200                     | Trace storage                                |
| Prometheus     | 9090                     | Metric storage                               |
| OTel Collector | 4317 (gRPC), 4318 (HTTP) | Telemetry ingest                             |
| GlitchTip      | 8000                     | Error tracking                               |

## Starting / Stopping

```bash
# Start
pnpm obs:up

# Stop (data preserved)
pnpm obs:down

# Tail logs from all observability containers
pnpm obs:logs

# Check container status
pnpm obs:status
```

## Data Volumes

All persistent data is stored in Docker named volumes:

| Volume                                 | Service      | Default location           |
| -------------------------------------- | ------------ | -------------------------- |
| `platform-obs-loki-data`               | Loki         | `/loki`                    |
| `platform-obs-prometheus-data`         | Prometheus   | `/prometheus`              |
| `platform-obs-tempo-data`              | Tempo        | `/tmp/tempo`               |
| `platform-obs-grafana-data`            | Grafana      | `/var/lib/grafana`         |
| `platform-obs-glitchtip-postgres-data` | GlitchTip DB | `/var/lib/postgresql/data` |

To check volume usage:

```bash
docker system df -v | grep platform-obs
```

## Configuration

All configuration is in `deploy/observability/`:

```
deploy/observability/
├── compose.yml                  # Service definitions
├── otel-collector.yaml          # OTel Collector routing rules
├── loki/config.yaml             # Loki storage + retention
├── prometheus/prometheus.yml    # Prometheus scrape config
├── tempo/config.yaml            # Tempo storage + retention
└── grafana/
    └── provisioning/
        ├── datasources/         # Grafana data source definitions
        ├── dashboards/          # Dashboard providers + JSON files
        └── alerting/            # Alert rules and contact points
```

To change Grafana dashboards: edit the JSON files in `grafana/provisioning/dashboards/json/` and restart Grafana (`docker restart grafana`). Do not edit dashboards via the Grafana UI — changes won't persist across restarts.

## Environment Variables Required

```bash
GRAFANA_ADMIN_PASSWORD=<strong-password>
GLITCHTIP_DB_PASSWORD=<strong-password>
GLITCHTIP_SECRET_KEY=<random-64-char-string>
GLITCHTIP_DOMAIN=https://errors.yourdomain.com
GRAFANA_ALERT_EMAIL=alerts@yourdomain.com
# Optional:
NTFY_URL=https://ntfy.sh/your-topic
```

## Access Control

Grafana and GlitchTip should be IP-restricted via the Caddy reverse proxy. Only the operator's IP and the platform's internal network should reach these services. See the Caddy configuration in `infra/caddy/`.

## Definition-of-Done items deferred until dependent apps exist

A handful of Objective 3 Definition of Done items cannot be ticked until the apps that consume the foundation are built. They are listed here so they are not forgotten when those apps land:

| DoD item                                          | Unblocked by                                                | What to wire when that lands                                                                                                                                         |
| ------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web app's `instrumentation.ts` hook               | Objective 11 (Schema Designer) or earliest web surface      | Create `apps/web/instrumentation.ts` exporting `register()` that calls `initTelemetry()` from `@platform/composition/instrumentation`                                |
| Worker's entry point initializes telemetry first  | The first worker objective (AI pipeline foundation, Obj 20) | First line of `apps/worker/src/index.ts` imports and calls `initTelemetry()` before any service composition                                                          |
| HTTP middleware records request metrics and spans | First HTTP server (web app or REST APIs in Obj 12)          | A small middleware reads `traceparent`, attaches a span named `HTTP <METHOD> <route>`, and records `platform_http_requests_total` + `_duration_seconds`              |
| Errors auto-link to traces via shared trace ID    | Web/worker app exists and uses ErrorReporterPort            | The Sentry/GlitchTip adapter already attaches the active trace ID; just ensure `errorReporter.report` is called from the boundary that wraps the HTTP/worker handler |
| All 15 verification steps in Objective 3 §8 pass  | Web/worker app exists; observability stack running          | Run the steps end-to-end; record results in `docs/compliance/` or as a checklist in this runbook                                                                     |

Until those apps exist, Objective 3 is **as complete as the foundation can be**: ports, adapters, composition initialiser, observability stack, dashboards, alerts, runbooks, ADRs, CI telemetry coverage, contributing guide, and PR template are all in place. The remaining items are wiring tasks that belong with the apps that do the wiring.
