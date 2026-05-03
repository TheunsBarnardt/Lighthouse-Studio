# ADR-0092: Chaos Engineering as Routine Practice

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

Software systems degrade in ways that tests don't catch: runbooks become stale, operators develop unverified assumptions about recovery behavior, infrastructure changes silently alter failure modes. The only way to know a system recovers correctly from failure is to induce failure and observe the actual behavior.

The first chaos drill (Objective 10) establishes a baseline. But a single drill has diminishing value over time — the system evolves, infrastructure changes, the operator's memory of what was tested fades. The question is: how do we maintain confidence in failure recovery as a living property, not a one-time check?

## Decision

Chaos engineering becomes a **quarterly routine**, not a one-time exercise.

**What runs quarterly:**

1. **Chaos drill** — the 13 scripted failure scenarios from `tests/chaos/`. Each scenario run against the current production-equivalent staging environment. New scenarios added for any new failure modes introduced since the previous drill.

2. **Chain integrity drill** — the audit log chain integrity check (established in Objective 7) run against production data. Any chain break is a critical incident.

3. **Restore drill** — a live database restore from the most recent backup to a fresh instance. Verified operational before tear-down. RTO/RPO confirmed against targets.

**What is documented per drill:**

- Date and environment
- Scenarios run and outcomes (pass/fail/unexpected behavior)
- Runbook gaps discovered and fixes applied
- Any new scenarios added
- Operator who ran the drill

**Where reports live:** `docs/quality/chaos-drill-<date>.md`, `docs/quality/dr-drill-<date>.md`

**What triggers an out-of-cycle drill:**

- A major infrastructure change (new database version, new OS version, deployment topology change)
- A production incident that exposed a failure mode not covered by existing scenarios
- A new failure scenario added to `tests/chaos/` — the scenario should be drilled before it reaches production

**The tooling:** Custom scripts in `tests/chaos/`, not Chaos Mesh or Litmus. The platform is small enough that targeted scripts are more useful than framework overhead. Each script is a TypeScript test that injects a specific failure, observes the system's behavior, and asserts the outcome. Scripts are version-controlled and reviewed like production code.

## Consequences

### Positive

- Runbooks stay current: each drill surfaces gaps; the operator fixes them before the gap causes a real incident.
- Operators maintain muscle memory for recovery procedures — quarterly practice prevents the "I haven't done this in two years" panic during a real incident.
- New scenarios accumulate over time, expanding the drill's coverage as the system grows.
- The discipline of documenting each drill creates an audit trail useful for SOC 2 (availability controls, testing evidence).

### Negative

- Quarterly drills require calendar discipline. They compete with feature work.
- A drill that goes wrong on staging can consume an afternoon. The mitigation is thorough staging environment provisioning and keeping the staging environment isolated from production.
- For a solo operator, "quarterly" is genuinely quarterly only if it's scheduled. It defaults to "when I remember."

## Mitigation for Solo Operations

- Drills are scheduled as calendar events before this objective closes.
- The first drill run (Objective 10) sets the template. Subsequent drills follow the same template with a new date — no blank-page problem.
- If a drill uncovers a scenario that takes longer to remediate than expected, it's tracked as a GitHub issue and the drill is marked "complete with outstanding items" — not delayed indefinitely.

## Alternatives Considered

**Annual drills.** Rejected: systems change faster than annually. Runbooks written a year ago against infrastructure that's been updated three times since are fiction.

**Automated chaos running continuously (chaos monkey style).** Rejected: the platform is a small team; continuous chaos would disrupt development. Quarterly targeted drills give the benefits without the constant disruption. Revisit when the team grows.

**No scheduled drills; only incident-triggered review.** Rejected: production incidents are the worst time to discover a runbook gap. The point of drills is to discover gaps before incidents, not after.
