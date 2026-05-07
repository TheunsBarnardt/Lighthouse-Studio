# Maintenance & Evolution Guide

Stage 10 of the AI Build Pipeline. Once a generated application is deployed, it enters
the maintenance phase: production signals flow in, the platform classifies them, operators
create change requests, and the pipeline re-engages the minimum necessary stages to resolve
issues. This cycle repeats continuously, making the generated application a living artifact
rather than a one-time output.

---

## Concepts

### Signal

A signal is any production event that may warrant action. Signals are ingested from:

- **Error monitors** — runtime exceptions from the generated application
- **Performance monitors** — latency spikes, error rate increases
- **User reports** — structured feedback from the in-app widget (opt-in)
- **Dependency advisories** — CVEs from OSV.dev and GitHub Security Advisories
- **Feature requests** — user-submitted enhancement requests

Signals are classified automatically by the AI and can be overridden by operators.

### Change Request

A change request is created from one or more signals. It describes the issue at the
pipeline level: which stage produced the defect, which artifact needs to change, and
what the expected outcome looks like.

Change request lifecycle: `open → in_progress → pending_approval → resolved` (or `wont_fix`)

### Stage Re-Engagement

Resolving a change request means re-running the affected pipeline stages with the context
of the change request. The platform identifies the minimum set of stages required (smallest
possible regeneration — ADR-0268) and queues them in order.

After re-engagement, the pipeline produces updated artifacts, which flow through test
generation and deployment as normal.

### Outcome Tracking

After a change request is resolved, the platform assesses whether the resolution actually
improved things. It compares pre-change and post-change metrics. If metrics degrade, a
`regressionDetected` flag is set and a new signal is automatically ingested.

---

## Workflow

### Responding to a new signal

1. Open the **Signals** tab
2. Review the AI classification — check the suggested stage and severity
3. If incorrect, click the classification to override
4. Select one or more related signals using the checkboxes
5. Click **Create Change Request** — the AI generates a summary and suggests stages

### Working a change request

1. Open the **Change Requests** tab
2. Review the description and suggested stages
3. Click **Engage Stage** — select the minimum stages required
4. Monitor pipeline progress in the relevant stage's UI
5. Once the pipeline completes and tests pass, deploy via Stage 9
6. Resolve the change request with the appropriate resolution type

### Reviewing dependency advisories

1. Open the **Advisories** tab
2. For each advisory, check whether the package is actively used (the impact assessment
   shows this automatically)
3. For `upgrade_now` advisories, create a change request immediately
4. For `upgrade_soon` advisories, schedule a change request for the next sprint
5. For `monitor` advisories, revisit in 30 days

### Reviewing outcomes

1. Open the **Outcomes** tab
2. Outcomes appear 7 days after a change request is resolved (configurable)
3. If `Regression` badge appears, a new change request has been created automatically —
   investigate using the regression runbook

---

## Architecture

```
Production App
     │
     ▼ errors / perf / user reports
MaintenanceService.ingestSignal()
     │
     ▼ async auto-classification (claude-haiku)
Signal.classification populated
     │
     ▼ operator creates change request
MaintenanceService.createChangeRequest()
     │
     ▼ operator engages stages
MaintenanceService.engageStages()
     │
     ▼ pipeline stages re-run (Objectives 22–28)
     │
     ▼ deploy (Objective 29)
     │
     ▼ outcome assessed (7 days later)
MaintenanceService.trackOutcome()
```

### Key service methods

| Method | Purpose |
|---|---|
| `ingestSignal` | Receive a signal; trigger async classification |
| `classifySignal` | AI classification of a single signal |
| `createChangeRequest` | Group signals into a CR with AI-generated summary |
| `engageStages` | Identify and queue minimum pipeline re-engagement |
| `identifyAffectedDownstream` | Cascade detection from changed artifact |
| `resolveChangeRequest` | Close a CR with resolution type and optional notes |
| `listDependencyAdvisories` | Fetch current advisories with impact assessment |
| `trackOutcome` | Compare pre/post metrics; detect regressions |

---

## Configuration

```typescript
// Workspace-level settings
{
  maintenance: {
    outcomeAssessmentWindowDays: 7,        // default: 7
    advisoryMinSeverity: 'medium',          // suppress low-severity advisories
    userReportWidgetEnabled: false,         // opt-in per workspace
    advisoryFeeds: ['osv', 'github'],       // replaceable for air-gapped installs
    maxInProgressHours: 48,                 // alert threshold for stuck CRs
  }
}
```

---

## Runbooks

- [Signal classification quality is poor](../runbooks/maintenance-signal-classification-poor.md)
- [Cascade storm — too many stages re-engaged](../runbooks/maintenance-cascade-storm.md)
- [Regression detected after fix](../runbooks/maintenance-regression-after-fix.md)
- [Dependency advisory storm](../runbooks/maintenance-dependency-advisory-storm.md)
- [Stuck change request](../runbooks/maintenance-stuck-change-request.md)
- [Outcome not improving after repeated fixes](../runbooks/maintenance-outcome-not-improving.md)

---

## Related Objectives

- **Objective 29** — Deployment (Stage 9) — re-engaged stages deploy via this pipeline
- **Objective 28** — Test Generation — tests run after re-engagement before deploy
- **Objective 20** — AI Pipeline Foundation — `definePrompt` / `registerPrompt` conventions
