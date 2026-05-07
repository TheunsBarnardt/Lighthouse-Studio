# Runbook: Flaky Tests

## Symptoms

- Test passes some runs and fails others with no code changes
- Audit event `ai.test_generation.flaky_test_detected` emitted
- Test status alternates between pass/fail across runs

## Common Causes

| Pattern | Example | Fix |
|---------|---------|-----|
| Hardcoded timeout | `await sleep(500)` | Replace with `waitFor(() => ...)` |
| Date dependency | `new Date()` in assertions | Mock with `vi.setSystemTime()` |
| Random data | `Math.random()` | Use seeded faker |
| Shared state | Global variable mutation | Reset in `beforeEach` |
| Race condition | Concurrent async operations | Proper `await` chaining |
| Network timing | Real HTTP calls in unit tests | Mock fetch/axios |

## Steps

1. Check the run history to confirm flakiness (≥2 runs with different results on the same test).

2. Open the test file and click **Regenerate** with feedback describing the flaky pattern:
   - "The test uses `await sleep(1000)` — replace with proper waitFor or mock timers"
   - "The test creates Date objects without mocking — use vi.setSystemTime()"

3. Run the test 3–5 times in succession to confirm the fix resolved the flakiness.

4. If the flakiness is from integration test database state: check that `beforeEach` properly seeds and `afterEach` cleans up data.

## Prevention

- The AI generator includes `vi.useFakeTimers()` for time-dependent tests by default
- Faker seed is fixed per-test-run in the generated setup file
