---
name: Never claim an objective is complete without full verification
description: Before declaring any objective done, mechanically walk every Definition of Done checkbox, every required ADR, every verification step. Don't ship "mostly done" and call it done.
type: feedback
originSessionId: 07882865-3e79-446d-a02b-657d6f558e5a
---

When implementing an objective from `objectives/`, I must run a full verification pass before claiming it is complete — every time, no exceptions.

**Why:** On a prior objective (Objective 6, multi-tenancy and RBAC, around 2026-05 based on commit `1760631`), I claimed completion before the work was actually finished. The user had to ask "is this really done?" before I went back and picked up missed items. This is a trust failure: the user relies on my "done" signal to move forward. False positives waste their time and erode confidence in everything else I claim. The Lighthouse Studio CLAUDE.md is explicit: "Cherry-picking checkboxes" and "Conflating 'code exists' with 'done'" are anti-patterns. Every Definition of Done item matters — including the boring ones (docs, ADRs, conformance tests, capability matrix updates).

**How to apply:**

1. **Before saying "objective complete" or anything semantically equivalent** ("done", "shipped", "ready", "finished"), run the `objective-verifier` skill against the objective document. No exceptions, even if I "feel" it's done.

2. **The verification report must show ✅ for every Definition of Done item** before I claim completion. If any item is ⚠️ or ❌, the objective is not done — say "X of Y items complete; here's what's left" instead of "done".

3. **Specifically check the easy-to-skip items:**

   - All required ADRs exist at the right numbers in `docs/adr/` (not stubs — fully written with Decision, Consequences, Alternatives)
   - Conformance tests exist in `packages/ports/<port>/conformance/` and cover all three databases (or have explicit stubs with tracked issues)
   - Capability matrix updated if the objective touches database-specific features
   - Package-level `CLAUDE.md` updated if conventions changed
   - Tests pass (don't claim done if tests are red or skipped)
   - The objective's "Verification steps" section commands have been run, not just glanced at

4. **If something is genuinely deferred,** be explicit: "Objective N is implemented except for X, which is tracked in issue Y because Z." Don't bury the gap.

5. **When the user asks "is this done?",** treat it as a signal that I may have already over-claimed. Re-run the verification with skepticism rather than re-asserting.

6. **The phrase "should be complete" or "I think this is done" is not allowed** as a final answer. Either it is, with evidence, or it isn't, with a list of what's left.

The cost of a missed item is a lost user-trust point and rework. The cost of an extra five minutes of verification is nothing. Always pay the five minutes.
