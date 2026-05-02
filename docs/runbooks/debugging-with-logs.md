# Runbook: Debugging with Logs

## Accessing Logs

Go to Grafana → Explore → Select **Loki** datasource.

## Common Queries

**All logs from a specific service (last 1 hour):**

```logql
{service="platform"}
```

**All error logs:**

```logql
{service="platform"} | json | level = "error"
```

**Find a request by correlation ID:**

```logql
{service="platform"} | json | correlationId = "01JXXXXXXXXXXXXXXXXXXXXXXX"
```

**Find all logs for a user:**

```logql
{service="platform"} | json | userId = "user_01JXXX"
```

**Find all logs for a workspace:**

```logql
{service="platform"} | json | workspaceId = "ws_01JXXX"
```

**Error logs with stack traces in the last 30 minutes:**

```logql
{service="platform"} | json | level = "error" | line_format "{{.msg}} — {{.err}}"
```

**Trace a request end-to-end:**

1. Get the correlation ID from the initial HTTP response header (`x-correlation-id`) or from the user's bug report.
2. Search Loki: `{service="platform"} | json | correlationId = "<id>"`
3. All log lines from that request — web app, database adapter, job worker — will appear.
4. Extract the `traceId` from any log line.
5. Open Grafana → Explore → Tempo → paste the `traceId`.

## Log Levels

| Level   | When used                                       |
| ------- | ----------------------------------------------- |
| `trace` | Very detailed, usually disabled in prod         |
| `debug` | Development and staging; off in prod by default |
| `info`  | Normal operation milestones                     |
| `warn`  | Unexpected but recoverable situations           |
| `error` | Operation failed; investigate                   |
| `fatal` | Process is about to exit                        |

## Changing Log Level at Runtime

Log level is set by the `LOG_LEVEL` env var. To increase verbosity temporarily:

1. Update `LOG_LEVEL=debug` in the deployment's env vars (via Coolify).
2. Redeploy or restart the service.
3. Investigate the issue.
4. Restore `LOG_LEVEL=info`.

## Retention

- Hot logs: 14 days (instantly queryable in Loki)
- Cold logs: 90 days (in Backblaze B2 if cold archive is configured)
- To query cold logs: use the Loki HTTP API with a time range in the cold archive window.
