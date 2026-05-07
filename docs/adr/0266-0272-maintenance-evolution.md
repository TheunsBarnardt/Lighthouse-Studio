# ADR-0266 through ADR-0272: Stage 10 — Maintenance & Evolution

> These ADRs cover the decisions made for Objective 30 (Stage 10: Maintenance & Evolution).
> The objective document specifies ADR-0219 through ADR-0225; numbers 0266–0272 are assigned
> because 0219–0225 were already allocated to prior objectives in this implementation run.

---

## ADR-0266: Signals as First-Class Inputs to the Pipeline

**Status:** Accepted
**Date:** 2026-05-07

### Context

Production systems generate continuous streams of information: error reports, performance
degradations, user feedback, dependency advisories. Treating these as external noise — to be
triaged manually and then fed into a new "project" — loses the causal link between production
reality and pipeline output.

### Decision

Signals are a first-class entity in the Lighthouse platform. Every production event that warrants
attention is ingested, classified, and linked to pipeline artifacts before any human action is
required. A change request is the bridge from signal to pipeline re-engagement.

### Consequences

- Signals accumulate over time; pagination and archival are required
- The feedback loop is explicit and auditable, not informal
- AI classification quality directly affects the signal-to-noise ratio of the dashboard

---

## ADR-0267: AI-Assisted Classification with Human Override

**Status:** Accepted
**Date:** 2026-05-07

### Context

Manually classifying every signal to a pipeline stage and severity level does not scale.
However, fully automated classification without oversight risks misdirecting work.

### Decision

Signal classification is AI-suggested (claude-haiku for cost), not AI-decided. The platform
auto-classifies on ingest but surfaces the result for human review. Operators can override
the suggested stage, severity, or cluster assignment before creating a change request.

### Consequences

- Every classification carries a confidence score and reasoning field for transparency
- The override path must be prominent in the UI — one click, not buried in a settings panel
- Classification quality improves over time by tracking override rates (future ML objective)

---

## ADR-0268: Smallest Possible Regeneration

**Status:** Accepted
**Date:** 2026-05-07

### Context

A bug in a generated UI component could, in principle, trigger regeneration of the entire
application: the PRD references the component, the architecture references the PRD, etc.
Re-running the full pipeline for a targeted fix is wasteful and risky (each regeneration
introduces variability).

### Decision

When a change request identifies affected pipeline stages, re-engage the minimum set of
stages that addresses the root cause. If only `ui_generation` produced the defect, only
`ui_generation` should be re-run. Cascade to downstream stages only when their inputs
actually changed.

### Consequences

- The platform must maintain an artifact dependency graph to determine minimum re-run scope
- "Minimum" is determined by the affected-downstream-detection prompt, not by heuristics
- Stage outputs carry a `derivedFrom` list; staleness propagates through this graph

---

## ADR-0269: Cascade Detection via Artifact Graph

**Status:** Accepted
**Date:** 2026-05-07

### Context

When an upstream artifact changes, downstream artifacts may be stale but are not automatically
invalid. A small PRD wording fix rarely invalidates generated code. A new requirement does.

### Decision

An explicit artifact dependency graph drives cascade detection. Each artifact records the
IDs and versions of the artifacts it was derived from. When an upstream artifact is updated,
the platform traverses the graph and classifies each downstream artifact as `stale`, `affected`,
or `unaffected` using an AI-assisted impact analysis prompt.

Artifacts classified as `affected` are included in the minimum re-engagement set.
Artifacts classified as `stale` are flagged for optional review but not automatically re-run.

### Consequences

- The artifact graph must be maintained on every generation step (adds a write per artifact)
- AI impact analysis can produce false positives; humans must be able to override
- The cascade detection prompt receives artifact summaries, not full content, for cost reasons

---

## ADR-0270: Outcome Tracking Closes the Loop

**Status:** Accepted
**Date:** 2026-05-07

### Context

A change request can be resolved without knowing whether the resolution actually improved
things. Without outcome tracking, the platform has no feedback on fix effectiveness and
cannot detect regressions introduced by the fix itself.

### Decision

When a change request transitions to `resolved`, the platform schedules an outcome assessment
7 days later (configurable). The assessment compares pre-change and post-change signal rates,
performance metrics, and user report frequency. If metrics degraded, a `regression_detected`
flag is set and a new signal is ingested automatically.

### Consequences

- Outcome assessment requires a metrics baseline captured at the time of the change request
- The 7-day window is a default; high-severity fixes may warrant a shorter window
- A regression creating a new signal creates a natural re-engagement loop

---

## ADR-0271: Dependency Advisories Surface but Don't Auto-Apply

**Status:** Accepted
**Date:** 2026-05-07

### Context

Dependency advisories from OSV.dev and GitHub Security Advisories are valuable signals, but
auto-applying upgrades in an enterprise platform would be unsafe: API breaking changes, licence
transitions, and indirect vulnerability introductions all require human judgment.

### Decision

Dependency advisories are ingested and displayed as a first-class tab in the Maintenance UI.
Operators review each advisory and explicitly create a change request to upgrade. The platform
provides a recommended action (`upgrade_now`, `upgrade_soon`, `monitor`) based on severity and
fix availability but never applies upgrades autonomously.

### Consequences

- Advisories for packages not used in the generated application should be filtered out
  (the `dependencyAdvisoryImpactPrompt` does this assessment)
- The advisory feed is configurable (`advisoryFeeds[]`) to support air-gapped installations
- Auto-PR creation for dependency bumps is a future objective (Objective 35+)

---

## ADR-0272: In-App Widget for User Reports

**Status:** Accepted
**Date:** 2026-05-07

### Context

End users of generated applications encounter bugs and have feature requests. Without a
structured intake channel, this feedback is lost or arrives informally via email or chat,
bypassing the signal pipeline entirely.

### Decision

Each generated application includes an opt-in feedback widget. The widget is injected by
the deployment scaffolding and sends structured `user_report` signals to the Lighthouse API.
Reports capture: message, URL, severity self-assessment, and an optional screenshot. PII
in the message is detected and redacted before storage.

### Consequences

- The widget is opt-in per workspace; off by default to respect user autonomy
- Screenshot upload requires explicit user consent within the widget flow
- PII redaction is best-effort (regex + NLP); sensitive deployments should disable screenshots
- The widget is a thin Lighthouse-hosted script injected via a single `<script>` tag

---

*Note: ADR-0253 (Advisory Ingestion Uses OSV as Primary Source) was written separately and already exists.*
