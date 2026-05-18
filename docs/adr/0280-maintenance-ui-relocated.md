# ADR-0280: Maintenance UI Relocated — Pipeline is 9 Build Stages + Continuous Loop

**Status:** Accepted
**Date:** 2026-05-18

## Context

Objective 30 specifies a **Maintenance & Evolution** capability as "Stage 10" of the AI build pipeline: collect production signals (errors, perf, user feedback, dependency advisories), classify them into change requests, route them back to specific upstream stages for re-engagement, then track the deployed outcome.

Implementation-wise this lived at `/ai-pipeline/maintenance` and appeared as the tenth step in the pipeline stepper and context-nav alongside the nine sequential build stages (Intent → Deployment).

That UI placement was wrong for two reasons:

1. **It is not a sequential build step.** Stages 1–9 are entered once per project, in order, with explicit hand-offs. Maintenance is **continuous and asynchronous** — signals arrive on their own clock, change requests are evaluated as they come in, and the work fans back out to whichever upstream stages are affected. Putting it as the tenth dot in a left-to-right stepper implies a linear progression that doesn't exist.
2. **Its panels naturally belong elsewhere.** Signals and outcome tracking are observability concerns and already live next to metrics/logs/traces conceptually; dependency advisories duplicate the existing `/advisors/cve` surface; change requests are a change-management surface, not a build artifact.

## Decision

Retire the `/ai-pipeline/maintenance` page. Split its panels across three existing or new surfaces:

| Old                               | New                           | Why                                                                                                                                                                                              |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SignalsListPanel`                | `/observability/signals`      | Continuous monitoring fits observability alongside metrics/logs/traces.                                                                                                                          |
| `OutcomeTrackingPanel`            | `/observability/outcomes`     | Post-deployment metric deltas are observability data.                                                                                                                                            |
| `ChangeRequestsPanel` (+ dialogs) | `/operations/change-requests` | The re-engagement bridge needs its own home; new `Operations` top-level mode hosts it. Also linked from the AI Pipeline left-nav under "Cross-cutting" so the loop-back path stays discoverable. |
| `DependencyAdvisoriesPanel`       | Dropped                       | `/advisors/cve` already covers dependency advisories with a richer surface; the maintenance variant was redundant.                                                                               |

The three change-request dialogs (`CreateChangeRequestDialog`, `EngageStageDialog`, `ResolveChangeRequestDialog`) move to `apps/web/src/components/change-requests/` since both `SignalsListPanel` and `ChangeRequestsPanel` consume them across route boundaries.

The pipeline stepper, AI pipeline overview page, context-nav, command palette, and the master "Stages complete N / 10" stat all update to **9 stages**.

Objective 30's logical content is preserved — signal collection → classification → change request → pipeline re-engagement → outcome tracking is unchanged. Only the UI consolidation page is gone.

## Consequences

**What this enables:**

- The pipeline reads as what it actually is: a 9-step build, then continuous operation.
- Signals and outcomes sit with the rest of observability, where users will already be when investigating production issues.
- Change requests get their own surface that can grow into a fuller change-management hub (incidents, runbooks, on-call) without dragging the build pipeline UI along.

**What this complicates:**

- Three places to look instead of one. The "Cross-cutting" link to `/operations/change-requests` inside the AI Pipeline nav mitigates this for the most common workflow (signal → CR → re-engage stage).
- Objective 30's title still says "Stage 10." We left the objective number/title for historical continuity and added a Section 0 note clarifying the UI split; the stage numbering is a documentation artifact, not a UI commitment.

**What becomes harder:**

- The visual story "ten stages from idea to evolving production app" now requires explaining the continuous loop separately. Marketing/onboarding material that depicted ten dots needs an update.

## Alternatives considered

1. **Keep `/ai-pipeline/maintenance` as the canonical surface.** Rejected — conflates the sequential build with the continuous loop and creates a fourth dependency-advisory surface that overlaps `/advisors/cve`.

2. **Put change-requests under `/advisors/change-requests`.** Rejected — advisors are automated findings the system surfaces _to_ the user; change requests are user-driven (or AI-suggested) decisions the user makes _on_ the system. Different mental model, different ownership.

3. **Keep change-requests at `/ai-pipeline/change-requests` rather than introducing an `Operations` mode.** Considered. Rejected because change-requests are the canonical entry point for many non-pipeline workflows (incident response, dependency bumps, hot-fixes) and will likely be joined by other ops surfaces — better to give them a non-pipeline home now than relocate later.

## References

- Objective 30 — Stage 10 — Maintenance & Evolution (Section 0 added to record the UI split)
- Objective 03 — Observability Foundation (signals infrastructure)
- `apps/web/src/app/observability/signals/`, `apps/web/src/app/observability/outcomes/`, `apps/web/src/app/operations/change-requests/`
- `apps/web/src/components/change-requests/` (shared dialogs)
- `apps/web/src/components/app-shell/shell-config.ts` (nav registration)
