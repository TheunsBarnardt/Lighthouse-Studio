# Objective 4c: Cross-Database Conformance Verification

**Status:** Ready for development
**Prerequisites:** Objectives 4 (Postgres), 4a (MSSQL), 4b (Mongo) complete
**Blocks:** Any feature objective that depends on cross-database parity guarantees

---

## 1. Purpose

The platform now has three persistence adapters that each pass their own conformance suite. This objective makes parity across them an enforced, continuously-verified property — not a snapshot.

The failure mode this prevents: someone fixes a bug in the Postgres adapter; the MSSQL adapter has the same bug, undetected; six months later, an MSSQL customer hits production data corruption. Or: a new feature is added to the platform; works on Postgres; nobody runs the Mongo conformance until release; ships broken to Mongo customers.

This objective produces no user-visible features. It produces a CI infrastructure that proves, on every PR, that all three adapters behave identically where they claim to, and divergence is explicit and intentional. It produces benchmarks that catch performance regressions per adapter. It produces drift detection that catches subtle behavior differences before they reach customers.

---

## 2. Scope

### In Scope

- Cross-database CI matrix: every conformance test runs against every adapter
- Property-based testing across adapters: same input, same output (modulo capability flags)
- Performance benchmarks per adapter with regression alerts
- Drift detection: when an adapter's output differs from another, surface it immediately
- Capability matrix documentation auto-generated from adapter declarations
- Continuous behavior comparison: a "shadow run" mode that runs an operation against all three adapters and diffs results
- CI scheduling strategy (cost vs. coverage tradeoff)
- Test data generators that produce semantically equivalent data for each adapter
- A "conformance score" per adapter, dashboarded
- Documentation of every known divergence (deliberate and undocumented)
- ADRs

### Out of Scope (Belongs to Later Objectives)

- The actual platform schema (still hasn't landed; comes with each module)
- Change streams parity (Objective 4d)
- Adapter performance optimization beyond catching regressions
- Production migration tooling between databases (an entirely separate undertaking; deferred indefinitely unless a customer demands it)

---

## 3. Locked Decisions

| Decision                     | Choice                                                                                                                                                   | Rationale                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Test runner                  | Vitest                                                                                                                                                   | Already in use; matrix support via projects                       |
| Property-based testing       | `fast-check`                                                                                                                                             | Industry standard for TS; integrates with Vitest                  |
| Benchmark tool               | `mitata` or `tinybench`                                                                                                                                  | Lightweight; produces structured JSON for CI consumption          |
| Matrix scheduling            | All adapters on PRs touching `packages/ports/persistence` or any `packages/adapters/persistence-*`; Postgres+MSSQL on all other PRs; nightly full matrix | Balances CI cost with parity guarantee                            |
| Database containers in CI    | GitHub Actions services for Postgres and Mongo; MSSQL via service container with a custom wait-for-ready check                                           | Standard pattern; warm in 30-60s                                  |
| Performance baseline storage | JSON files in `bench/baselines/<adapter>/` committed to repo                                                                                             | No external dependency; reviewable in PRs                         |
| Regression threshold         | 20% slowdown over baseline triggers warning; 50% triggers PR comment + reviewer required                                                                 | Tight enough to catch real issues, loose enough not to flag noise |
| Drift detection mechanism    | Snapshot-style: each adapter's output recorded; diffs against the others highlighted                                                                     | Approachable; reviewers can SEE the difference                    |
| Conformance score            | Percentage of conformance tests passing per adapter, with capability-flag-skipped tests counted in denominator                                           | Honest score; reflects actual portability                         |
| Cross-adapter property tests | Live in `packages/ports/persistence/cross-adapter/`                                                                                                      | Centralized; runs against every adapter                           |
| Reporting                    | Generated in `docs/contracts/persistence-conformance-report.md` on every push to main                                                                    | Always up-to-date docs of what works where                        |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    PR triggers CI                                     │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
       ┌─────────────────────────────────────────┐
       │    Adapter scope detection              │
       │    (paths-filter on changed files)       │
       └────┬───────────────────────────┬────────┘
            │                           │
   touches persistence?            touches everything else
            │                           │
            ▼                           ▼
    ┌───────────────┐           ┌───────────────┐
    │ Run all three │           │ Run Postgres  │
    │ adapters in   │           │ + MSSQL only  │
    │ parallel      │           │               │
    └───────┬───────┘           └───────┬───────┘
            │                           │
            └─────────────┬─────────────┘
                          │
                          ▼
            ┌─────────────────────────────────┐
            │ For each adapter, in parallel:   │
            │  - Conformance tests (fast)      │
            │  - Property tests (slower)       │
            │  - Benchmarks (slowest)          │
            │  - Drift detection (compares     │
            │    outputs across adapters)     │
            └─────────────┬───────────────────┘
                          │
                          ▼
            ┌─────────────────────────────────┐
            │ Aggregate results                │
            │ - Conformance score per adapter  │
            │ - Performance vs. baseline       │
            │ - Drift summary                  │
            │ - Capability matrix update       │
            └─────────────┬───────────────────┘
                          │
                          ▼
            ┌─────────────────────────────────┐
            │ Post PR comment with summary     │
            │ Update docs on merge             │
            │ Fail PR on hard violations       │
            └─────────────────────────────────┘
```

A nightly scheduled job runs the full matrix regardless of PR scope, plus heavier tests (longer property test runs, larger benchmark datasets, deeper drift verification).

---

## 5. Component Specifications

### 5.1 The Conformance Test Suite (Restated)

The conformance test suite already exists from Objective 1.5 and was implemented and exercised in Objectives 4, 4a, 4b. This objective doesn't create new conformance tests — it ensures the existing ones run continuously, in parallel, against every adapter.

The suite covers:

- All operations on `RepositoryPort` (findById, findOne, findMany, count, create, update, archive, hardDelete)
- All operations on `UnitOfWorkPort` (transaction commit, rollback, nested savepoints, deadlock retry, timeout)
- All operations on `QueryPort`
- All operations on `SchemaIntrospectionPort` (listSchemas, listTables, describeTable, listIndexes, listForeignKeys, listConstraints, supports)
- All operations on `SchemaDdlPort` (createTable, alterTable, dropTable, validate, type round-trip)
- All operations on `SchemaMigrationPort` (apply, list, revert)
- Filter AST translation (10,000 random filters per adapter; verified for syntactic validity and semantic correctness)
- Type round-trip (every supported normalized type, written and read back)
- Optimistic locking (concurrent updates; one wins, one returns ConflictError)
- Soft delete (archive/restore behavior)
- Statement timeouts
- Error mapping (driver errors → typed platform errors)

Per-adapter capability flags determine which tests run vs. skip. A skipped test counts as "conformant by capability declaration"; a failed test counts as "non-conformant."

### 5.2 Cross-Adapter Property Tests

New in this objective. These tests **don't run against a single adapter** — they run a single operation against **all three adapters simultaneously** and verify the results match.

Location: `packages/ports/persistence/cross-adapter/`

Example shape:

```typescript
// cross-adapter/repository-equivalence.spec.ts
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { withAllAdapters } from './harness';

describe('RepositoryPort cross-adapter equivalence', () => {
  withAllAdapters('findMany returns equivalent results across adapters', async (adapters) => {
    await fc.assert(
      fc.asyncProperty(fc.array(genTestEntity(), { minLength: 5, maxLength: 50 }), genFilter(), async (entities, filter) => {
        // Seed each adapter with the same entities
        for (const a of adapters) {
          await a.repo.create(entities);
        }

        // Run the same query against each
        const results = await Promise.all(adapters.map((a) => a.repo.findMany({ filter })));

        // Results must be equivalent (modulo ordering when not specified)
        assertResultsEquivalent(results);
      }),
      { numRuns: 100 }, // 100 random cases per CI run; 1000 nightly
    );
  });
});
```

The `withAllAdapters` harness:

- Spins up Postgres, MSSQL, Mongo (or skips Mongo if its capability gates the test)
- Creates the same logical schema on each
- Provides repository instances for each
- Cleans up after the test

`assertResultsEquivalent` accounts for legitimate differences:

- Ordering: if the query doesn't specify `ORDER BY`, sorted comparison
- Date precision: if Mongo gives millisecond precision and Postgres gives microsecond, normalize to milliseconds for comparison
- Type representation: BigInt as string vs. number, etc.

These tests are slow (each run involves three databases doing work), so they run with a smaller `numRuns` on PRs and a larger one nightly.

**What's tested cross-adapter:**

- `findById` — identity must be preserved across adapters
- `findMany` with filters — semantically equivalent results
- `count` — identical numbers
- `create` then `findById` — round-trip
- `update` with optimistic lock — same lock behavior
- `archive` — same effect on subsequent queries
- Type round-trip (every supported type, every adapter)
- Sort behavior (where defined)
- Pagination (offset and cursor)
- Filter translator equivalence

**What's NOT tested cross-adapter (and why):**

- Performance characteristics — each adapter has its own baseline; cross-adapter performance isn't a parity concern
- Native query execution paths — adapters use different SQL/Mongo, so the path differs even when results match
- Error message text — error TYPES are the contract (typed errors); error MESSAGES are not
- Schema introspection of customer-defined collections — too database-specific to compare directly

### 5.3 Capability-Flag-Aware Test Skipping

Every conformance and cross-adapter test declares which capabilities it requires:

```typescript
withAllAdapters.requires(['foreign_keys'])('FK constraint enforced across all adapters', async (adapters) => {
  // ... test that runs only on adapters declaring foreign_keys: true
});
```

When a test is skipped due to capability mismatch:

- The test runner emits a structured `skipped(reason)` result
- Skipped tests count as "conformant by capability declaration" in the score
- A separate report lists skipped-by-capability tests per adapter — making the gap honest and visible

This means a skipped Mongo FK test doesn't hide a problem. The capability matrix shows the gap, and customers see exactly what their chosen adapter can and can't do.

### 5.4 Performance Benchmarks

Per-adapter benchmarks live in `bench/<adapter>/` directories. Each benchmark:

- Sets up a deterministic dataset (size and shape documented in the benchmark file)
- Runs each operation N times with warmup
- Records p50, p95, p99 latencies
- Records throughput (operations per second)
- Outputs a structured JSON result

**Benchmarked operations:**

- `findById` on tables of 100, 10k, and 1M rows
- `findMany` with simple filter, complex filter, on 10k and 1M rows
- `count` on 1M rows with various filters
- `create` (single, batch of 100, batch of 10k)
- `update` (single)
- Optimistic lock conflict handling
- Filter translation overhead (the AST → SQL/Mongo conversion isolated)
- Connection pool acquisition under load

**Baselines:**

Stored as JSON in `bench/baselines/<adapter>/<benchmark-name>.json`. Each baseline file contains:

- Last recorded p50/p95/p99
- Median over the last 10 successful runs
- Last update date
- Hardware fingerprint (CPU model, core count, memory, OS) — runs on different hardware aren't comparable

**On PR:**

Benchmarks run on a deterministic CI runner. Results compared against the median of recent baselines. If p95 regresses by more than 20%, a warning is posted to the PR. If by more than 50%, a hard reviewer-required block is added.

If a regression is intentional (e.g., trading some throughput for correctness), the PR includes a baseline update commit explaining the change. The baseline file is updated atomically alongside the code change that caused the regression.

**Cross-adapter performance comparison:**

Reported but not enforced. Postgres might be 3x faster than MSSQL on a given operation; that's allowed. The point is to catch regressions per adapter, not to homogenize performance.

### 5.5 Drift Detection

A "drift detector" runs select operations against all three adapters and diffs results. Different from cross-adapter equivalence tests because:

- Equivalence tests are designed; the inputs are crafted
- Drift detection runs realistic, varied scenarios — mini-fuzzing — and reports any divergence

Implementation:

- A test corpus of "scenarios" — sequences of operations forming realistic workloads (create some workspaces, add members, run queries, update, archive, etc.)
- Each scenario runs against each adapter
- At each step, the state is captured (rows present, query results, etc.)
- Final states (and intermediate query results) are diffed across adapters
- Differences are categorized:
  - Expected (capability-driven, e.g., MSSQL doesn't have arrays, so a scenario with arrays won't run on MSSQL)
  - Tolerable (precision differences, ordering)
  - Unacceptable (different counts, different content)

Unacceptable drift fails the CI run. Tolerable drift is logged. Expected differences are reported as a capability matrix.

### 5.6 Capability Matrix Generation

A script (`scripts/generate-capability-matrix.mts`) reads each adapter's capability declarations at startup time and produces:

- `docs/contracts/capability-matrix.md` — a human-readable table showing which features work where
- `packages/ports/persistence/src/capabilities.json` — a machine-readable version for the data management module's UI to consume at runtime

Example matrix output:

```markdown
## Capability Matrix

| Feature           | Postgres | MSSQL | MongoDB |
| ----------------- | -------- | ----- | ------- |
| schemas           | ✅       | ✅    | ❌      |
| foreign_keys      | ✅       | ✅    | ❌      |
| check_constraints | ✅       | ✅    | ✅\*    |
| json_columns      | ✅       | ✅\*  | ✅      |
| array_columns     | ✅       | ❌    | ✅      |
| partial_indexes   | ✅       | ✅    | ✅      |
| unique_indexes    | ✅       | ✅    | ✅      |
| spatial_indexes   | ✅\*     | ✅\*  | ✅      |
| transactions      | ✅       | ✅    | ✅\*    |
| change_streams    | ✅\*     | ✅\*  | ✅      |

- = with caveats; see notes
```

The matrix is regenerated on every merge to main and committed to the repo.

### 5.7 Conformance Score Dashboard

A simple dashboard shows the current state per adapter:

- % of conformance tests passing
- % of conformance tests skipped by capability flag
- % of cross-adapter property tests passing
- Performance regression status
- Drift detection: green/yellow/red

This dashboard is rendered:

- In Grafana (data fed from CI artifacts)
- In `docs/contracts/persistence-conformance-report.md` (regenerated on every merge)
- As a badge in the repo's README

The badge is calibrated so green only appears when ALL adapters are at 100% conformance for capabilities they declare. A failing test in any adapter, or undeclared drift, shows yellow or red.

### 5.8 CI Pipeline Configuration

`.github/workflows/persistence-conformance.yml`:

```yaml
name: Persistence Conformance

on:
  pull_request:
    paths:
      - 'packages/ports/persistence/**'
      - 'packages/adapters/persistence-*/**'
      - 'bench/**'
      - 'packages/composition/**'
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # 02:00 UTC nightly = 04:00 SAST

jobs:
  detect-scope:
    # ...sets outputs.adapters to ['postgres', 'mssql', 'mongo'] or smaller subset

  conformance:
    needs: detect-scope
    strategy:
      matrix:
        adapter: ${{ fromJSON(needs.detect-scope.outputs.adapters) }}
      fail-fast: false
    services:
      # adapter-specific service container
    steps:
      - run: pnpm test:conformance --adapter ${{ matrix.adapter }}
      - uses: actions/upload-artifact@v4
        with:
          name: conformance-${{ matrix.adapter }}
          path: results/

  cross-adapter:
    needs: conformance
    if: contains(needs.detect-scope.outputs.adapters, 'postgres') && contains(needs.detect-scope.outputs.adapters, 'mssql')
    services:
      postgres: ...
      mssql: ...
      mongo: ...
    steps:
      - run: pnpm test:cross-adapter
      - uses: actions/upload-artifact@v4

  benchmarks:
    needs: conformance
    if: github.event_name != 'schedule' # nightly does deeper benchmarks separately
    strategy:
      matrix:
        adapter: ${{ fromJSON(needs.detect-scope.outputs.adapters) }}
    steps:
      - run: pnpm bench --adapter ${{ matrix.adapter }} --compare-baseline
      - run: pnpm bench:report --pr ${{ github.event.pull_request.number }}

  drift-detection:
    needs: conformance
    services:
      postgres: ...
      mssql: ...
      mongo: ...
    steps:
      - run: pnpm test:drift
      - uses: actions/upload-artifact@v4

  aggregate:
    needs: [conformance, cross-adapter, benchmarks, drift-detection]
    if: always()
    steps:
      - uses: actions/download-artifact@v4
      - run: pnpm conformance:aggregate
      - uses: actions/github-script@v7
        # Posts a single consolidated comment to the PR

  nightly-deep:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    services:
      postgres: ...
      mssql: ...
      mongo: ...
    steps:
      - run: pnpm test:cross-adapter --runs 1000
      - run: pnpm bench --adapter all --large-dataset
      - run: pnpm test:drift --extended
      - run: pnpm conformance:report:full --output=docs/contracts/persistence-conformance-report.md
      - uses: peter-evans/create-pull-request@v6
        # Auto-PR if the report changed
```

### 5.9 Service Container Tuning

Bringing up Postgres, MSSQL, and Mongo in the same CI runner is resource-intensive. Tuning:

- **Postgres**: warms in ~5 seconds; cheap.
- **MSSQL**: warms in 30–60 seconds; needs an explicit "wait for SA login ready" check (a TCP-listening port doesn't mean SQL Server is ready). The CI step polls `sqlcmd -Q "SELECT 1"` until success.
- **Mongo**: replica set initialization takes ~10–20 seconds. CI step runs `rs.initiate()` and then polls `rs.status()` until `myState: 1` (primary).

Total warmup adds ~1–2 minutes to CI runs that include all three. Acceptable.

For PRs that don't touch persistence, the simpler matrix (Postgres + MSSQL) shaves 20-40 seconds.

For PRs that don't touch anything in `packages/adapters/persistence-*` and only edit, e.g., a markdown file, no databases run at all.

### 5.10 PR Comment Template

The aggregator step posts a structured comment summarizing results:

```markdown
## Persistence Conformance Report

### Conformance

- ✅ **Postgres**: 247/247 tests passing (100%)
- ✅ **MSSQL**: 224/247 tests passing (100% of 224 capability-allowed)
- ⚠️ **MongoDB**: 211/214 tests passing (98.6% of capability-allowed). 3 failing:
  - `RepositoryPort > update with expectedVersion handles optimistic conflict`
  - `UnitOfWorkPort > nested transactions`
  - `SchemaIntrospectionPort > sample inference for unmanaged collection`

### Cross-Adapter Equivalence

- ✅ All 1240 cross-adapter property tests pass

### Performance

- ✅ No regressions over 20%
- ⚠️ 1 borderline regression (15-19%):
  - `findMany_complex_filter_1m_rows` on Postgres: p95 from 142ms → 168ms

### Drift Detection

- ✅ No unacceptable drift detected
- 7 tolerable differences (precision/ordering); see attached report.

### Capability Matrix

No changes since last main.
```

### 5.11 Documentation Outputs

The infrastructure produces several living documents updated on every merge:

- `docs/contracts/capability-matrix.md` — the table shown above
- `docs/contracts/persistence-conformance-report.md` — full report with per-test pass/fail and timestamps
- `docs/contracts/persistence-divergence.md` — accumulated documented divergences and their rationale
- `docs/contracts/persistence-benchmarks.md` — current performance baselines per adapter

These files are auto-generated and committed by the nightly job. PRs can also update them manually when capability declarations change.

---

## 6. Implementation Order

1. **Set up the cross-adapter test harness** in `packages/ports/persistence/cross-adapter/`. The `withAllAdapters` helper, the result equivalence asserter, and the test data generators.

2. **Write the first cross-adapter property test** for `RepositoryPort.findMany`. Run it locally against all three adapters; ensure it passes.

3. **Add capability-aware skipping** to the test harness. Tests declare required capabilities; skipped tests are categorized.

4. **Add cross-adapter tests for the rest of the persistence ports**: every operation, every type, every relevant edge case.

5. **Set up benchmarks** in `bench/<adapter>/`. Implement the benchmarked operations from Section 5.4. Generate the first baselines.

6. **Add the regression detection script**: compare current run to baselines, output structured results, threshold logic.

7. **Set up the drift detector**: scenario corpus, per-adapter execution, diffing.

8. **Build the `generate-capability-matrix.mts` script**.

9. **Build the conformance score aggregator**: collects all the artifacts (conformance results, cross-adapter results, benchmarks, drift) and produces the dashboard data.

10. **Wire everything into CI**: the workflow file from Section 5.8, with proper service containers and waits.

11. **Build the PR comment poster**: consolidates everything into one readable summary.

12. **Set up the nightly job**: deeper runs, regenerates docs, opens auto-PRs.

13. **Calibrate the regression thresholds** by running the system against a few weeks of normal development, adjusting noise floors.

14. **Write all runbooks and ADRs.**

15. **Verify Definition of Done.**

---

## 7. ADRs to Write

- **ADR-0042: Cross-Database Conformance as a Continuous Property** — why CI matrix, why per-PR vs. nightly, what the score means
- **ADR-0043: Property-Based Cross-Adapter Equivalence** — why fast-check, what's tested, what's not, why
- **ADR-0044: Performance Regression Thresholds** — 20% warn, 50% block; how baselines work; how hardware fingerprints prevent false positives
- **ADR-0045: Drift Detection vs. Equivalence Testing** — what each catches that the other doesn't
- **ADR-0046: Capability Flag as Documentation** — declared capabilities ARE the parity contract; the matrix IS the spec

---

## 8. Verification Steps

1. **Conformance CI matrix runs.** A PR touching `packages/adapters/persistence-postgres/` triggers the full three-adapter run. A PR touching `apps/web/` triggers the simpler Postgres + MSSQL run.

2. **Conformance scores accurate.** Each adapter's pass/skip count matches what's expected from its capabilities. Manual inspection of one report confirms.

3. **Cross-adapter equivalence catches a deliberate divergence.** Introduce a bug in one adapter that produces different results from the others; CI fails with a clear message identifying which adapter and which test.

4. **Capability-flag-aware skipping.** A test requiring `foreign_keys` is skipped on Mongo with a clear "skipped: capability foreign_keys not supported" message in the output.

5. **Benchmarks run.** Each adapter's benchmark file produces a JSON result. Comparison to baseline produces a regression report.

6. **Regression alerting works.** Introduce an artificial 30% slowdown in one adapter's findById. CI posts a warning comment naming the operation and adapter.

7. **Hard regression block works.** Introduce a 60% slowdown. CI posts a block comment requiring reviewer approval.

8. **Drift detector finds intentional drift.** Create a divergent scenario; run the drift detector; the divergence appears in the output with full context.

9. **Capability matrix generates correctly.** Manually compare the generated `capability-matrix.md` against the adapters' declared capabilities; matches.

10. **PR comment is readable.** Open a test PR; the consolidated comment is clear and actionable.

11. **Nightly job runs successfully.** The scheduled run fires at 02:00 UTC, runs all the deeper tests, and updates docs (or opens an auto-PR if the docs changed).

12. **Service containers are stable.** Run the CI 50 times in a row (locally or in a test branch); flake rate < 1%.

13. **Runtime cost is acceptable.** PR with full matrix completes in < 10 minutes; PR with simpler matrix completes in < 6 minutes.

14. **Conformance report is current** in `docs/contracts/persistence-conformance-report.md` after a merge to main.

If all 14 pass, the objective is met.

---

## 9. Definition of Done

**Test Infrastructure**

- [ ] `withAllAdapters` harness in `packages/ports/persistence/cross-adapter/`
- [ ] At least one cross-adapter property test per persistence port operation
- [ ] Capability-aware skipping working
- [ ] Test data generators producing semantically equivalent data per adapter

**Benchmarks**

- [ ] Benchmark suite per adapter in `bench/<adapter>/`
- [ ] All operations from Section 5.4 covered
- [ ] Baselines generated and committed
- [ ] Regression detection script working
- [ ] Hardware fingerprinting prevents false positives across runners

**Drift Detection**

- [ ] Scenario corpus in `tests/drift-scenarios/`
- [ ] Per-adapter execution
- [ ] Diff categorization (expected, tolerable, unacceptable)

**Capability Matrix**

- [ ] `scripts/generate-capability-matrix.mts` produces accurate output
- [ ] `docs/contracts/capability-matrix.md` regenerates on merge to main
- [ ] `packages/ports/persistence/src/capabilities.json` is current

**CI**

- [ ] `.github/workflows/persistence-conformance.yml` configured
- [ ] Adapter scope detection working (paths-filter)
- [ ] Service containers stable for all three databases
- [ ] PR comments posted with consolidated results
- [ ] Nightly deep run scheduled

**Reporting**

- [ ] `docs/contracts/persistence-conformance-report.md` auto-generated
- [ ] `docs/contracts/persistence-divergence.md` accumulated rationale
- [ ] `docs/contracts/persistence-benchmarks.md` baselines documented
- [ ] Conformance score in repo README badge

**Documentation**

- [ ] ADRs 0042–0046 written and Accepted
- [ ] Runbook for diagnosing conformance failures
- [ ] Runbook for updating baselines after intentional changes

**Verification**

- [ ] All 14 verification steps in Section 8 pass
- [ ] CI total time on full matrix PR is under 10 minutes
- [ ] Flake rate measured below 1%

---

## 10. Anti-Patterns to Refuse

- **"This test is flaky on Mongo, just disable it on Mongo."** No. Either the test is wrong (fix it) or the adapter is wrong (fix that) or there's a real capability gap (declare it). Disabling tests silently is how parity rots.
- **Loosening cross-adapter equivalence to "make tests pass."** The point of these tests is to catch divergence. If they're divergent, that's a finding, not a problem to suppress.
- **Updating a baseline without explaining why.** Every baseline change is a deliberate decision; the PR documents the rationale.
- **Running the full matrix on every PR regardless of scope.** Wastes CI minutes; slows the development loop. Scope detection is the right answer.
- **Letting the nightly job fail silently.** Nightly failures are real failures. Alert routes to the same place as PR failures.
- **"It's only 25% slower; the threshold is 20% warn / 50% block, so we'll just merge with the warning."** Warnings are not noise; they're notice that something changed. Investigate. Don't accumulate.
- **Skipping capability-flag updates when adapter behavior changes.** Capability flags are the contract; flags lying produce data corruption.
- **Hand-editing auto-generated docs.** They'll be overwritten. Edit the source.
- **Treating conformance as Postgres parity.** Postgres is one adapter. Conformance is "all three behave the same way for declared capabilities." Postgres-specific assumptions must be removed from the suite.

---

## 11. Open Questions for Confirmation Before Starting

1. **Regression thresholds: 20% warn / 50% block — too tight, too loose, or right?** Recommendation: start at these; calibrate after a few weeks of operation.

2. **Nightly deep run dataset size.** How big are the benchmark datasets nightly? Recommendation: 100k rows for "normal" benchmarks, 10M for the deepest. 10M rows on three databases takes time but catches the regressions hot loops don't.

3. **CI cost: full matrix on every persistence-touching PR is the expensive choice.** The cheap alternative: full matrix on PRs that touch the conformance suite or any adapter; smaller matrix on PRs that touch only one adapter. Recommendation: full matrix on persistence-touching PRs, period — this is the whole reason we're doing this. CI cost is fine.

4. **Drift scenario corpus — who writes it?** Recommendation: start with 10 hand-written scenarios covering the obvious workloads (workspace setup, member management, project lifecycle, archival, etc.). Grow it organically as new bugs emerge.

5. **Reporting: PR comment vs. status check vs. both?** Recommendation: both. The status check fails the PR check; the comment provides the actionable detail.

---

## 12. What Comes Next

With Objective 4c complete, the platform's persistence layer has continuous, mechanical parity verification across all three databases. Drift between adapters is detected before it ships. Capability gaps are documented. Performance regressions are caught.

**Objective 4d: Change Streams** is next. It implements `ChangeStreamPort` for each database — Postgres logical replication, MSSQL CDC, Mongo change streams. This is what powers the data management module's real-time table view feature, the killer Supabase feature now available on any database.

After 4d, the data layer is genuinely complete across all three databases. Then **Objective 5: Identity, Auth, and User Directory** lands as part of the data management module — the platform's built-in auth IS the Supabase-clone auth feature, with Entra ID, OIDC, SAML as alternative `IdentityProviderPort` implementations for enterprise customers.

---

_This document is the contract. Every checkbox in Section 9 must be true before moving on._
