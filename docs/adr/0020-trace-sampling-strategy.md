# ADR-0020: Trace Sampling Strategy

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Distributed tracing produces one trace per request. At production volumes (100 req/s) this is 8.6 million traces/day, each potentially containing dozens of spans. Storing and indexing all of them would exhaust the 7-day retention budget in hours. But dropping traces at the source means missing the very errors and slow requests we need to investigate.

Two sampling strategies exist: head-based (decide at trace start) and tail-based (decide after the trace completes, when all spans are known). Head-based is simpler but makes the decision before we know whether the trace is interesting. Tail-based is more expensive (all spans buffered until decision) but can guarantee keeping every error trace.

## Decision

Two-layer sampling:

1. **Head-based at the SDK:** 100% of traces are started (no SDK-level sampling). Every request gets a trace. This costs little — the decision to keep or drop happens downstream.

2. **Tail-based at the OTel Collector:**
   - Keep all traces containing at least one span with `status = ERROR`
   - Keep all traces with total duration > 1 second
   - Keep 10% of remaining (healthy) traces uniformly at random
   - `decision_wait = 30s` — the Collector buffers spans for 30s before deciding

The result: every error and every slow request is retained. Healthy traffic is sampled to 10%, keeping storage manageable.

## Consequences

### Positive

- Zero error traces are ever dropped — forensics on incidents is always possible.
- Slow requests are always captured — performance regressions are detectable.
- Collector-side sampling means no changes to application code when tuning sampling rates.
- 10% of healthy traces provides sufficient signal for service map and latency histograms.

### Negative

- `decision_wait = 30s` means the Collector buffers up to 30s of spans in memory before exporting. At 100 req/s with 10 spans/trace = 30,000 spans in memory. With the 512 MB memory limit, this is feasible but must be monitored.
- If the Collector crashes during the decision window, buffered spans are lost.
- Tail sampling adds ~100ms of export latency vs. head-based.

### Neutral

- The 10% sample rate for healthy traffic is tunable via the Collector config. No code change needed.
- If sampling proves insufficient in future (e.g., post-scale), we add a separate "high-value" policy (e.g., keep 100% of AI generation traces).

## Alternatives Considered

### Option A: Head-based 10% Sampling

Simple. But 10% of error traces are dropped at source — forensics on rare errors becomes a probability game. Rejected.

### Option B: Head-based 100% Sampling (No Tail Sampling)

All traces stored. At scale, Tempo storage grows without bound. With 7-day retention and 100 req/s, this is ~60 GB of trace data/day. Feasible on the 8 GB VPS only at low traffic volumes. Rejected as a permanent strategy; may be used in early dev.

## References

- Objective 3 (Observability Foundation)
- ADR-0019 (OpenTelemetry as Standard)
- OpenTelemetry Tail Sampling Processor: https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor
