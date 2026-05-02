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
