# Runbook: Observability Stack Recovery

The observability stack going down is an incident, but it must not take the platform with it. Platform services are designed to continue operating when the OTel Collector is unreachable (the SDK queues and eventually drops with a warning; no crashes).

## Symptoms

- Grafana is unreachable
- No new logs appearing in Loki
- Alerts stop firing (which can be mistaken for all-clear)

## The Most Important Thing

**Loss of observability is not loss of service.** The platform is still serving users. Recovering observability is high priority but not emergency-halt priority unless the platform itself is also affected.

## Recovery Steps

### 1. Check container status

```bash
pnpm obs:status
# or
docker compose -f deploy/observability/compose.yml ps
```

### 2. Identify the failing container

Look for `Exited` or `Restarting` status. Check logs:

```bash
docker logs loki --tail 100
docker logs prometheus --tail 100
docker logs otel-collector --tail 100
docker logs grafana --tail 100
```

### 3. Restart the affected service

```bash
docker restart <container-name>
# or restart the whole stack:
pnpm obs:down && pnpm obs:up
```

### 4. Verify data integrity after restart

Loki: `curl -s http://localhost:3100/ready` → should return `ready`
Prometheus: `curl -s http://localhost:9090/-/ready` → should return `Prometheus Server is Ready`
Tempo: `curl -s http://localhost:3200/ready` → should return `ready`

### 5. Check for data loss

- Loki: query for logs from the outage window. If data is missing, it was dropped by the OTel Collector during the outage window (the SDK queues for a limited time then drops).
- Prometheus: check for gaps in time-series panels. Prometheus on restart replays its WAL; data should be intact.
- Tempo: trace data from the outage window may be partially lost if the OTel Collector was not running.

### 6. OTel Collector recovery

If the Collector was down, platform services queued spans/metrics/logs in memory. After the Collector restarts, the backlog should flush automatically. Watch for:

- Increased CPU on the Collector for a few minutes (flushing the backlog)
- A burst of data in Grafana as the backlog arrives

## Disk Full Recovery

If Loki, Prometheus, or Tempo is crashing due to disk full:

```bash
# Check disk usage
docker system df
df -h

# Compact Loki (frees old data)
docker exec loki logcli query --limit=1 '{}' 2>/dev/null || true

# Force Prometheus compaction
curl -X POST http://localhost:9090/api/v1/admin/tsdb/clean_tombstones
```

For a persistent disk full issue, reduce retention in the respective config files (Loki: `retention_period`, Prometheus: `--storage.tsdb.retention.time`).
