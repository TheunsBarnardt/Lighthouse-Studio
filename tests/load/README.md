# Load Tests

k6-based load test suite for Objective 10 quality gates.

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed on the test runner machine
- Staging environment running and accessible
- Load test data seeded: `pnpm load:seed`

## Seeding test data

```sh
LOAD_TEST_BASE_URL=https://staging.platform.internal \
DATABASE_URL=postgresql://... \
pnpm load:seed
```

Use `--scale=tenth` for a quick local smoke run. Use `--scale=full` for the actual gate.

## Running scenarios

```sh
# Sustained load (1 hour — full gate)
k6 run --env LOAD_TEST_BASE_URL=https://staging.platform.internal \
       tests/load/scenarios/sustained-load.js

# Burst load
k6 run --env LOAD_TEST_BASE_URL=https://staging.platform.internal \
       tests/load/scenarios/burst-load.js

# Sustained writes
k6 run --env LOAD_TEST_BASE_URL=https://staging.platform.internal \
       tests/load/scenarios/sustained-writes.js

# Audit query load
k6 run --env LOAD_TEST_BASE_URL=https://staging.platform.internal \
       tests/load/scenarios/audit-query.js

# Change stream load
k6 run --env LOAD_TEST_BASE_URL=https://staging.platform.internal \
       tests/load/scenarios/change-stream-load.js
```

## CI smoke variant

The CI smoke run uses reduced duration (60 seconds) and fewer VUs to catch regressions fast:

```sh
k6 run --env LOAD_TEST_BASE_URL=... \
       --env LOAD_TEST_DURATION=60s \
       tests/load/scenarios/sustained-load.js
```

This is what runs on every PR. The full gate (1 hour sustained) runs nightly.

## Performance baselines

After the full gate passes, baselines are committed to `bench/baselines/`.
CI compares subsequent runs against these baselines and fails if a metric
regresses by more than the documented threshold.
