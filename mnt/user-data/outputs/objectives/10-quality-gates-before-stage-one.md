# Objective 10: Quality Gates Before Stage One

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 family, 5, 6, 7, 8, 9 complete
**Blocks:** Stage 1 of the AI build pipeline; the Data Management Module; production launch

---

## 1. Purpose

Verify, with evidence, that the foundation built across the previous objectives is genuinely ready to support production workloads, customer security reviews, regulatory compliance scrutiny, and the feature work that begins after this objective. Not "we think it's ready" — **proven ready**, by tests run, drills executed, reports written, and reviewers signed off.

This is the consolidation. Every previous objective declared its own done. This objective verifies that done collectively means done — that the foundation as a whole behaves correctly under realistic load, hostile probing, and chaotic conditions, and that the documentation a customer's security team needs is genuinely in place.

If this objective fails, the failure is recoverable: fix the gaps and re-verify. If we ship feature work before this objective passes, the failure is unrecoverable: feature code accumulates on a foundation with hidden flaws, and finding the flaws later costs ten times what fixing them now does.

This objective produces no user-visible features. It produces **evidence and confidence**: load test reports, penetration test results, chaos drill outcomes, accessibility audits, security checklists, and the foundation completeness review.

---

## 2. Scope

### In Scope

- Load testing the foundation under realistic and stressed loads
- Penetration testing the auth, RBAC, and audit layers
- Chaos engineering: induced failures, recovery verification
- Accessibility baseline (WCAG 2.2 AA on foundation pages)
- Security checklist verification (OWASP ASVS, OWASP Top 10, OWASP API Security Top 10)
- Backup and restore drill at scale
- Disaster recovery drill (full server loss simulation)
- Performance baselines as commitments (the foundation's SLO targets)
- Cross-database conformance final verification
- Cross-platform runtime final verification
- Documentation completeness review
- Compliance posture review (the documents from Objective 7)
- Foundation review report — a single document attesting that the foundation is ready
- Sign-off process

### Out of Scope (Belongs to Later Objectives)

- Feature-specific quality gates (each feature objective has its own)
- Customer-facing onboarding (separate; happens after this)
- Marketing materials or sales collateral
- Continuous quality measurement (CI already does this; this objective is the snapshot, not the ongoing process)
- Bug-hunting bounty programs (a customer-acquisition tactic; out of scope)

---

## 3. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Load testing tool | k6 (open source, Grafana-stewarded) | Industry standard; integrates with our observability stack; scriptable in TS-like JS |
| Penetration testing | Internal review using OWASP ASVS Level 2 checklist; external review before first paying customer | Internal first; external is expensive but required for credibility |
| Chaos engineering tool | Custom scripts (the platform is small enough that we can target failures specifically without needing Litmus or Chaos Mesh) | Targeted, repeatable, version-controlled |
| Accessibility audit tool | axe-core for automated; manual screen-reader test (NVDA on Windows, VoiceOver on macOS) | Automated catches common issues; manual catches the rest |
| Performance baselines | Established here; CI checks against them on every PR going forward | Regressions caught early |
| SLO targets | 99.5% availability, p95 latency < 500ms, p99 < 2s, 0 cross-tenant data leaks | Established in Objective 3; verified here |
| Foundation review report | A single signed document; required for stage one work to begin | Forcing function for completeness |
| Sign-off | Maintainer + at least one external reviewer (security-focused) | Two-person rule for the foundation gate |
| Test data | Realistic synthetic data, generated reproducibly | Real customer data must never enter test environments |
| Test environment | A dedicated staging environment that mirrors production exactly | Catches deployment-specific bugs |
| Pass criteria | Defined per gate; ALL gates must pass; no waivers | Quality gates that are bypassable aren't gates |

---

## 4. The Quality Gates

Each gate is a discrete verification that produces evidence. All must pass before the foundation is considered complete.

### 4.1 Load Test Gate

**Goal:** verify the foundation handles realistic load with headroom.

**Targets:**

- **Sustained load**: 100 concurrent users performing typical operations (sign-in, list workspaces, create artifacts, query audit logs) for 1 hour. p95 latency under 500ms throughout. Zero errors. Memory stable.

- **Burst load**: 500 concurrent users for 5 minutes. p95 latency under 1s. Errors under 0.1%. Recovery within 60 seconds after burst ends.

- **Sustained writes**: 50 writes/second across mixed entity types for 30 minutes. Database connection pool not exhausted. Audit chain integrity maintained. No deadlocks beyond expected retry rate.

- **Audit query load**: 10 audit-log queries/second against a workspace with 1M audit events. p95 query latency under 200ms. No locking issues.

- **Change stream load**: 100 subscribers, 50 events/second produced; verify all subscribers receive events within 2 seconds; no events lost; no buffer overflow.

**Setup:**

- A dedicated load test environment provisioned via the same infrastructure as production
- Realistic data: 10,000 users, 100 workspaces, 100,000 artifacts, 1M audit events
- k6 scripts in `tests/load/` simulating realistic user behavior, not just hammering one endpoint
- Run against all three database adapters (Postgres, MSSQL, Mongo); each must independently meet the targets
- Observability stack captures all metrics during the run; reports are generated post-run

**Pass criteria:**

- All targets met on all three database adapters
- No memory leaks (RSS stable over the 1-hour sustained run)
- No connection pool exhaustion
- No audit chain integrity failures
- No cross-tenant data leakage detected by audit log review post-run

**Output:**

- Load test report at `docs/quality/load-test-report-<date>.md`
- Performance baselines updated in `bench/baselines/`
- Grafana dashboard snapshot embedded in the report

### 4.2 Penetration Test Gate

**Goal:** verify the security model holds against active probing.

**Scope:**

- **Authentication bypass attempts**: every reasonable attack vector against the auth layer (token forgery, session fixation, OAuth state manipulation, magic link replay, password reset token reuse, MFA bypass, account takeover via email change)
- **Authorization bypass attempts**: cross-workspace access, role escalation, IDOR (insecure direct object reference) on workspace-scoped resources, parameter tampering, capability flag misuse
- **Injection attacks**: SQL injection (across all three databases), NoSQL injection on Mongo, command injection in any process spawning code, log injection, header injection, XSS in any rendered output
- **Audit tampering attempts**: trying to write audit events as the wrong user, modify existing events, delete events, modify the chain
- **Resource exhaustion**: trying to OOM the server with large requests, trigger expensive queries, exhaust connection pools, fill the disk
- **Cryptography review**: password hashing, session token entropy, JWT signing keys, secret storage encryption

**Methodology:**

- **Internal phase**: against OWASP ASVS Level 2 checklist (~150 controls). Each control marked pass / fail / not-applicable with evidence.
- **OWASP Top 10 walkthrough**: each of the top 10 web app vulnerabilities and top 10 API vulnerabilities verified against the platform.
- **External phase**: a contracted security firm performs a full pentest, ideally including:
  - Automated scanning (Burp, OWASP ZAP)
  - Manual probing of auth, authz, injection vectors
  - Source code review of `packages/core/src/services/auth*` and `packages/adapters/identity-*`
  - A short report with findings categorized as critical / high / medium / low / informational

**Pass criteria:**

- Internal OWASP ASVS Level 2 checklist 100% pass with documented evidence (or N/A with justification)
- OWASP Top 10 (web + API) all addressed
- External pentest: zero critical findings; any high findings remediated; medium findings remediated or explicitly accepted with rationale
- No credential leaks in logs (verified by reviewing 24 hours of production-grade logs from the load test run)

**Output:**

- Internal review report at `docs/quality/security-review-internal-<date>.md`
- External pentest report attached as evidence (not committed if confidential; referenced)
- Remediation log for any findings

**Note on external pentest:** the recommendation in earlier objectives is to commission this before the first paying customer, not before stage one work begins. The split:

- **Required for this objective:** internal OWASP ASVS Level 2 review + automated security scanning
- **Required before production launch with real customers:** external pentest

This objective passes when the internal phase is complete. The external phase is a separate gate before launch.

### 4.3 Chaos Engineering Gate

**Goal:** verify the system recovers from failures without data loss or extended downtime.

**Failure scenarios injected:**

- **Database connection loss**: kill database for 30 seconds; verify the platform handles errors gracefully, retries succeed when DB returns, no data corruption
- **Database connection pool exhaustion**: hold all pool connections; verify graceful degradation, no crash, queue or reject as appropriate
- **Worker process killed mid-job**: send SIGKILL to worker during AI generation job; verify job is retried, no double-execution
- **Web app process killed mid-request**: kill web app while requests in flight; clients see appropriate error; no data corruption
- **Audit log writes fail**: simulate audit storage unavailability; verify the system fails closed (operations rejected) rather than fail open (operations proceed without audit)
- **Change stream consumer disconnected**: kill a change stream subscriber; verify the source stream continues; reconnection picks up correctly
- **Disk full on platform host**: fill disk; verify graceful degradation; logs rotate; no crash
- **Network partition between web and database**: simulate using `tc` (Linux); verify timeout behavior, retry logic
- **Time skew**: set the system clock 5 minutes off; verify session handling, token validation, audit timestamps
- **Power loss simulation**: hard-stop the VM during a write; restart; verify database recovers, no audit chain breakage, no data corruption
- **Concurrent migrations**: trigger two migration runs simultaneously (intentional bug or operator error); verify locking prevents corruption
- **Backup interruption**: cancel a backup mid-run; verify the next scheduled run completes successfully and the failed run is logged
- **Restore over running database**: simulate the operator mistake of restoring on top of a live database; verify safeguards catch this

**Methodology:**

- Each scenario is a script in `tests/chaos/<scenario>.test.ts` runnable in the staging environment
- Scenarios run in a "chaos drill" event: maintainer schedules, executes, observes, documents
- Scripted automation handles the failure injection; observation is human-driven (we want to see what the system actually does)

**Pass criteria:**

- Every scenario: the system either recovers automatically OR fails safely with operator-actionable alerts
- No data corruption in any scenario
- No audit chain integrity failures
- No cross-tenant leakage from any scenario
- Recovery time (where automatic) under 60 seconds for simple failures, under 5 minutes for major failures (worker crash, disk fill cleanup)

**Output:**

- Chaos drill report at `docs/quality/chaos-drill-<date>.md`
- Per-scenario evidence: logs, metrics screenshots, operator notes
- Updated runbooks: any failure that revealed a runbook gap gets the runbook fixed

### 4.4 Accessibility Gate

**Goal:** the foundation pages (sign-in, sign-up, workspace list, account settings) meet WCAG 2.2 AA.

**Scope:**

The foundation has minimal UI — login screens, account management, basic workspace selection. The data management module (later objective) and stage one feature pages will need their own accessibility audits. This gate covers what exists.

**Methodology:**

- **Automated**: axe-core run against every foundation page in CI
- **Manual screen reader**: NVDA on Windows + VoiceOver on macOS, walkthrough of every flow
- **Keyboard-only navigation**: complete every flow without a mouse
- **Color contrast**: verify all text meets WCAG AA contrast (4.5:1 for normal, 3:1 for large)
- **Focus management**: focus visible, focus order logical, focus trapped in modals
- **ARIA**: roles, labels, landmarks, live regions used correctly

**Pass criteria:**

- axe-core: zero violations at "serious" or "critical" severity; "minor" violations triaged
- Screen reader: every flow completable; semantic structure understandable; live updates announced
- Keyboard-only: every flow completable; no keyboard traps
- Color contrast: all text passes
- Issues found are documented and either fixed before this gate passes OR explicitly deferred with a tracked issue and a target date

**Output:**

- Accessibility audit report at `docs/quality/accessibility-<date>.md`
- axe-core CI check added; any new violation in the foundation pages fails the build

### 4.5 Backup and Disaster Recovery Drill

**Goal:** verify the platform can be restored from backup, end-to-end, in a disaster scenario.

**Scenarios:**

1. **Single-database restore**: restore yesterday's database backup to a fresh instance; verify integrity (audit chain valid, foreign keys consistent, row counts match expected); reconnect the platform to the restored DB; verify it operates normally.

2. **Object storage restore**: restore stored files from Backblaze B2 to a fresh storage backend; verify file integrity (checksums match); the platform reads them correctly.

3. **Full server loss**: simulate complete loss of the platform server. Provision new server, follow the disaster recovery runbook, restore database, restore object storage, restart services. Time to fully operational: under 4 hours.

4. **Partial corruption**: simulate corruption of the audit table; verify chain verification detects it; restore from backup; verify audit chain integrity after restore.

5. **Encryption passphrase recovery**: ensure the Restic encryption passphrase recovery process works. The "sealed envelope" or password-manager-only-isn't-enough drill.

**Pass criteria:**

- Each scenario completes successfully
- Recovery time within documented RTO (4 hours for full DR)
- Data loss within documented RPO (24 hours for daily backup; less if WAL archiving enabled)
- Operator completes the runbook without ad-hoc decisions; gaps in the runbook are fixed

**Output:**

- DR drill report at `docs/quality/dr-drill-<date>.md`
- Updated runbooks for any gaps discovered

### 4.6 Cross-Database Conformance Final

**Goal:** the cross-database conformance suite from Objective 4c passes 100% on all three adapters with no skipped tests beyond declared capability gaps.

**This is largely a confirmation step**: the conformance suite has been running on every PR throughout objectives 4 family forward. Here we run it explicitly as a quality gate, document the result, and lock in the capability matrix as a versioned artifact.

**Methodology:**

- Run the full conformance suite in matrix mode (Postgres + MSSQL + Mongo) on a clean environment
- Run cross-adapter property tests with extended `numRuns` (10,000 cases per property)
- Generate the capability matrix report

**Pass criteria:**

- All conformance tests pass on all three adapters or are skipped due to declared capability gaps
- All cross-adapter property tests pass (no equivalence failures)
- No drift detected
- Capability matrix is current

**Output:**

- Conformance report committed to `docs/quality/conformance-<date>.md`
- Capability matrix snapshot at `docs/quality/capability-matrix-<date>.md`

### 4.7 Cross-Platform Runtime Final

**Goal:** confirm the platform runs identically on Linux and Windows for all foundation operations.

**Methodology:**

- Provision two parallel staging environments: one Linux, one Windows
- Run a battery of foundation tests against both
- Compare behavior: same auth flow, same data round-trips, same audit events, same observability output

**Pass criteria:**

- Foundation tests pass on both platforms
- No platform-specific bugs uncovered
- Performance baselines met on both (Windows is allowed to be slightly slower; documented as platform note)
- The customer Windows deployment guide tested by following it on a fresh VM

**Output:**

- Cross-platform verification report at `docs/quality/cross-platform-<date>.md`

### 4.8 Documentation Completeness Review

**Goal:** the documentation a customer needs to evaluate, deploy, operate, and audit the platform is in place.

**Checklist:**

- [ ] Architecture overview (the C4 diagrams or equivalent)
- [ ] All ADRs from objectives 1 through 9 present and indexed
- [ ] All runbooks from objectives 1 through 9 present
- [ ] Customer deployment guide (Linux via Coolify) — Objective 2
- [ ] Customer deployment guide (Windows + IIS) — Objective 9
- [ ] Per-database deployment guide (Postgres, MSSQL, Mongo) — Objective 4 family
- [ ] Per-identity-provider configuration guide (built-in, Entra, OIDC, SAML) — Objective 5
- [ ] Service authoring guide — Objective 8
- [ ] Capability matrix — Objective 4c, refreshed by 4.6
- [ ] Personal data registry — Objective 7
- [ ] Audit event catalog — Objective 7
- [ ] SOC 2 / GDPR / HIPAA control matrices — Objective 7
- [ ] Threat model — Objective 7
- [ ] API reference (auto-generated from zod schemas; minimal at this stage but exists)
- [ ] Glossary of platform terminology
- [ ] Onboarding documentation for new contributors (CONTRIBUTING.md plus the developer-getting-started doc)

**Methodology:**

- A documentation reviewer (could be a contracted technical writer, or a non-engineer in the company who tries to find things) walks through each item
- Anything unclear, outdated, or missing is fixed before this gate passes

**Pass criteria:**

- Every item on the checklist exists and is current
- No "TODO" comments in published documentation
- All cross-references work
- Anyone clearly outside the project team can find what they need without help

**Output:**

- Documentation review report at `docs/quality/docs-review-<date>.md`

### 4.9 Compliance Posture Review

**Goal:** the compliance posture documents from Objective 7 are credible and actionable.

**Methodology:**

- A reviewer with compliance background (internal counsel, contracted compliance consultant, or experienced peer) walks through each control matrix
- For each claim ("the platform supports X"), the reviewer requests evidence: which audit event, which configuration option, which code path proves the claim
- Inconsistencies between the documents and the platform's actual behavior are flagged

**Pass criteria:**

- SOC 2 Trust Services Criteria control matrix: each control has evidence; no claims without backing
- GDPR control matrix: data subject rights tested end-to-end (access, erasure); legal basis documented for each PII category
- HIPAA control matrix (if relevant): each Security Rule and Privacy Rule requirement addressed
- Threat model is current and reflects the architecture
- Personal data registry matches the actual data model

**Output:**

- Compliance posture review report at `docs/quality/compliance-<date>.md`
- Any gaps remediated and re-verified

### 4.10 The Foundation Review Report

**The capstone deliverable.** A single document that consolidates the outputs of all the gates above, attests that the foundation is ready, and is signed off by the maintainer and at least one external reviewer.

**Structure:**

```markdown
# Platform Foundation Review

**Date:** YYYY-MM-DD
**Maintainer sign-off:** [name, signature, date]
**External reviewer sign-off:** [name, signature, date]

## Executive Summary

The platform foundation across objectives 1 through 9 has been verified
ready for feature development. Quality gates passed:

| Gate                        | Result | Evidence                          |
| --------------------------- | ------ | --------------------------------- |
| Load Testing                | Pass   | docs/quality/load-test-...        |
| Penetration Testing (int.)  | Pass   | docs/quality/security-review-...  |
| Chaos Engineering           | Pass   | docs/quality/chaos-drill-...      |
| Accessibility               | Pass   | docs/quality/accessibility-...    |
| Backup & DR                 | Pass   | docs/quality/dr-drill-...         |
| Cross-Database Conformance  | Pass   | docs/quality/conformance-...      |
| Cross-Platform Runtime      | Pass   | docs/quality/cross-platform-...   |
| Documentation Completeness  | Pass   | docs/quality/docs-review-...      |
| Compliance Posture          | Pass   | docs/quality/compliance-...       |

## Conditions and Caveats

[Any non-blocking issues that were noted but accepted, with rationale.]

## What Comes Next

The platform proceeds to feature development:
- The Data Management Module (the Supabase-clone-for-any-database feature)
- Stage 1 of the AI build pipeline (Intent Capture)
- ... etc.

External penetration test scheduled before first paying customer.

## Foundation Stability Commitment

The maintainer commits that:
- Future changes will not regress the verified properties of this foundation
- The CI gates will continue to enforce the quality bars established here
- Any change touching the foundation requires re-running the relevant gate
- Quarterly drills (chain integrity, restore, chaos) continue indefinitely
```

This document is the gate. With it, feature work begins. Without it, it doesn't.

---

## 5. Implementation Order

1. **Provision the dedicated staging environment** that mirrors production. This becomes the testbed for all the gates.

2. **Generate realistic synthetic test data** at scale: 10,000 users, 100 workspaces, 100,000 artifacts, 1M audit events. Reproducible via a script.

3. **Implement load testing scripts** in `tests/load/` using k6. One script per scenario from Section 4.1.

4. **Run the load test gate.** Iterate on findings; fix bottlenecks; re-run until pass criteria are met.

5. **Implement chaos scripts** in `tests/chaos/`. One per scenario in Section 4.3.

6. **Run the chaos drill.** Document each scenario; update runbooks for any gaps.

7. **Internal security review** against OWASP ASVS Level 2. This is a multi-day exercise of going through the checklist control by control.

8. **Run automated security scanning** (Burp Community, OWASP ZAP) against the staging environment. Triage findings.

9. **Engage external pentest firm** for the external review (parallel to other gates; doesn't block this objective if the engagement extends past the timeline; a follow-up gate handles it before customer launch).

10. **Run the accessibility audit.** Automated via axe-core; manual via NVDA/VoiceOver. Fix violations.

11. **Run the DR drill.** Provision a fresh server, restore from backups, verify operational. Document gaps.

12. **Run the cross-database conformance final.** Should pass automatically given the work in Objectives 4 and 4c; this is a verification snapshot.

13. **Run the cross-platform runtime final.** Provision Linux and Windows staging; run the test battery; compare results.

14. **Documentation completeness review.** A reviewer walks the checklist; gaps are filled.

15. **Compliance posture review.** A compliance-experienced reviewer walks the matrices; gaps are filled.

16. **Author the Foundation Review Report.** Consolidates the evidence.

17. **External reviewer sign-off.** Find a credible external reviewer (security-experienced engineer, compliance consultant, or peer with relevant background) to review the report and the underlying evidence, sign off.

18. **The foundation is ready.** Stage 1 and the Data Management Module begin.

---

## 6. ADRs to Write

- **ADR-0089: Quality Gates Before Stage One** — what gates, what passes, why this discipline before features
- **ADR-0090: External Pentest Before Production, Internal Before Stage One** — the split, the rationale, the cost trade-off
- **ADR-0091: Chaos Engineering as Routine Practice** — drills run quarterly; failures inform runbooks
- **ADR-0092: Foundation Stability Commitment** — what we promise about backward-compatibility of the foundation properties

---

## 7. Verification Steps

Verification of THIS objective is each gate's pass criteria being met. Specifically:

1. Load test gate has a passing report committed.
2. Internal security review report committed; ASVS Level 2 checklist 100% pass.
3. Automated security scan reports clean.
4. Chaos drill report committed; every scenario passed.
5. Accessibility audit report committed; axe-core in CI.
6. DR drill report committed; recovery within RTO/RPO.
7. Cross-database conformance report committed.
8. Cross-platform runtime report committed.
9. Documentation completeness report committed.
10. Compliance posture review report committed.
11. Foundation Review Report committed and signed off.
12. External reviewer sign-off documented in the Foundation Review Report.

If all 12 are present and the underlying gates passed, the objective is met.

---

## 8. Definition of Done

**Test Infrastructure**
- [ ] Dedicated staging environment provisioned and documented
- [ ] Synthetic data generation script reproducible
- [ ] Load test scripts in `tests/load/`
- [ ] Chaos scripts in `tests/chaos/`
- [ ] Accessibility automation (axe-core) in CI

**Gate Outputs**
- [ ] Load test report
- [ ] Internal security review report
- [ ] Automated security scan reports
- [ ] Chaos drill report
- [ ] Accessibility audit report
- [ ] DR drill report
- [ ] Cross-database conformance report
- [ ] Cross-platform runtime report
- [ ] Documentation completeness report
- [ ] Compliance posture review report

**The Capstone**
- [ ] Foundation Review Report authored
- [ ] Maintainer sign-off
- [ ] External reviewer sign-off
- [ ] Performance baselines locked in
- [ ] Any deferred items have tracked issues with target dates

**Continuous Verification**
- [ ] CI runs the load tests as a smoke version on every PR (full version nightly)
- [ ] CI runs accessibility checks on every PR
- [ ] Quarterly chaos drill scheduled
- [ ] Quarterly chain integrity drill scheduled (already from Objective 7)
- [ ] Quarterly restore drill scheduled

**Documentation**
- [ ] ADRs 0089–0092 written and Accepted
- [ ] All gate reports committed to `docs/quality/`
- [ ] Foundation Review Report committed at `docs/quality/foundation-review.md`

---

## 9. Anti-Patterns to Refuse

- **"We'll fix that finding later."** Findings either get fixed before this gate passes, or they get explicit acceptance with rationale documented. Nothing implicit.
- **Skipping the external reviewer because "I trust myself."** The external reviewer catches what the maintainer is too close to see. Two-person rule for the foundation gate.
- **Running the load test against synthetic data that's too tidy.** Realistic data has edge cases (nulls in optional fields, very long strings, unicode in names, dates near boundaries). The data generator includes these.
- **Treating the chaos drill as theater.** Real failure injection. Real observation. Real documentation. If the drill is "happy path with the lights off," it's not a drill.
- **Letting the accessibility audit slide because "we'll fix it later when the UI is more developed."** The foundation pages are the entry point to the platform. They set the standard. WCAG AA from day one.
- **Treating documentation review as a formality.** A reviewer who doesn't actually try to use the docs catches nothing. Pick a reviewer who will be honest.
- **Signing off on incomplete evidence.** "Mostly passed" isn't pass. The gate's pass criteria are precise; meeting them is binary.
- **Running gates in parallel and merging "good enough" results.** Each gate runs to completion; each gate's failures are addressed before sign-off.
- **Skipping the foundation review because "the team knows the work is good."** The artifact exists for new team members, customers, auditors, and future-you. The fact that you know is irrelevant; the artifact knows for everyone else.

---

## 10. Open Questions for Confirmation Before Starting

1. **External reviewer** — who? Security-experienced engineer in your network; compliance consultant; peer with relevant background? Recommendation: combination — a security-experienced engineer for the security and chaos parts, a compliance consultant for the compliance posture review (these can be different people).

2. **External pentest budget** — recommendation: $10k-$30k for a small-to-mid-sized firm doing a one-week engagement. Some maintainers find this prohibitive for the foundation gate; the compromise (do it before customer launch instead) is in Section 4.2.

3. **Load test environment cost** — running k6 with realistic load against a full staging environment for hours costs cloud minutes. Recommendation: use Afrihost VPS that mirrors production sizing; k6 runs from your machine or a separate small VPS as the load generator.

4. **Synthetic data realism vs. effort** — generating 1M audit events with realistic distribution takes thought. Recommendation: don't aim for production realism on day one; aim for realistic enough that performance bottlenecks surface. Refine the generator over time.

5. **Documentation reviewer** — recommendation: someone outside the engineering work but technically literate. A friend who works at another startup, a contracted technical writer, anyone who can ask "I'm a customer evaluating this — show me how X works" and notice when the docs don't answer.

6. **Cadence of post-objective drills** — proposing quarterly for chaos, restore, chain integrity, and cross-platform. That's manageable for solo. Acceptable, or scale to monthly?

---

## 11. What Comes Next

With Objective 10 complete, the foundation is **proven** ready, not assumed. The Foundation Review Report is the artifact that matters: a single signed document attesting that the platform's substrate is solid.

Three streams of work begin in parallel:

**1. The Data Management Module.** The Supabase-clone-for-any-database feature. Built on top of the persistence layer (Objective 4 family), the change streams (Objective 4d), the identity layer (Objective 5), the RBAC (Objective 6), and the audit (Objective 7). Surfaces all of these as a coherent product feature.

**2. Stage 1 of the AI Build Pipeline: Intent Capture.** The first stage of the conversational AI workflow. Generates intent briefs from user descriptions, with reasoning attached, approvable per the configurable approval routing.

**3. The remaining stages of the AI build pipeline (Stages 2-10).** Each its own objective; each follows the canonical service pattern from Objective 8; each is observed, tested, and audited per the foundation's discipline.

These three streams interleave: the data management module's UI uses the platform's identity layer, which means the data management module's auth UI is the first feature-level UI that exposes the auth from Objective 5. The AI pipeline's artifacts are stored via the persistence layer; their approvals route via the RBAC engine.

By the time these three streams ship their first usable versions, the platform is genuinely a product — sellable to Microsoft houses, sellable to displaced enterprise professionals building their own ventures, sellable to teams that want enterprise-grade software development discipline at solo speeds.

The foundation made all of this possible. **It was the right thing to build first.**

---

*This document is the contract. Every checkbox in Section 8 must be true before stage one or the data management module begins.*
