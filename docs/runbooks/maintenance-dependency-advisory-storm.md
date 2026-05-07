# Runbook: Dependency Advisory Storm

**Severity:** Medium
**Trigger:** OSV or GitHub Security Advisories feed produces a large batch of advisories simultaneously

---

## Symptoms

- The Advisories tab shows 10+ new advisories at once
- Operators are unsure which advisories are actionable vs. noise
- Multiple advisories affect the same package at different severity levels

---

## Diagnosis

1. Check whether the advisories are from a scheduled feed sync or a manual trigger
2. Identify how many affect packages actually used by generated applications (vs. transitive deps)
3. Look for the `recommendedAction` field — prioritise `upgrade_now` advisories first

---

## Resolution

### Triage

1. Filter advisories by `severity: 'critical'` or `severity: 'high'` — address these first
2. Use the `dependencyAdvisoryImpactPrompt` output to confirm the package is actually used
3. For advisories affecting the same package at different versions, consolidate into a single
   change request targeting the highest fixed version

### Batch Processing

1. Create one change request per affected package (not per CVE)
2. Set priority based on severity: `p0` for critical, `p1` for high, `p2` for medium, `p3` for low
3. Engage `code_generation` stage for dependency bumps — the generated `package.json` must be updated

---

## Prevention

- Configure the advisory feed to filter by packages present in generated `package.json` at ingest time
- Set a workspace-level advisory minimum severity to suppress low-severity noise
- Schedule advisory syncs during off-hours to avoid flooding the dashboard during business hours
