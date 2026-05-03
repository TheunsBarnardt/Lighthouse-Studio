# Performance Baselines

Established by the Objective 10 load test gate.
Updated only when intentionally improving performance — not to silence regressions.

CI compares each PR's load test smoke run against these baselines.
A regression of > 20% on p95 latency fails the build.

## Files

Each file is a JSON object with adapter-specific values:

```json
{
  "postgres": { "p50": 45, "p95": 312, "p99": 891 },
  "mssql": { "p50": 52, "p95": 341, "p99": 923 },
  "mongodb": { "p50": 48, "p95": 298, "p99": 812 }
}
```

## Baseline files

| File                            | Metric                           | Target   |
| ------------------------------- | -------------------------------- | -------- |
| `sustained-load-p95-ms.json`    | p95 latency under sustained load | < 500ms  |
| `burst-load-p95-ms.json`        | p95 latency under burst load     | < 1000ms |
| `audit-query-p95-ms.json`       | p95 latency for audit queries    | < 200ms  |
| `write-throughput-per-sec.json` | Sustained write throughput       | >= 50/s  |

## Status

Baselines have not yet been established. They will be populated when the load test gate runs for the first time and passes.
