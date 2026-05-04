---
name: Never claim an objective is complete without full verification
description: Before declaring any objective done, mechanically walk every Definition of Done checkbox, every required ADR, every verification step. Don't ship "mostly done" and call it done.
type: feedback
originSessionId: 07882865-3e79-446d-a02b-657d6f558e5a
---

When implementing an objective from `objectives/`, I must run a full verification pass before claiming it is complete — every time, no exceptions. **The user should never have to ask "is it done?" — that question itself means I failed.**

**Why:** This has now happened repeatedly across objectives (originally Objective 6, multi-tenancy/RBAC, ~2026-05, commit `1760631`; reinforced 2026-05-03 after the user explicitly said "Why do I have to keep asking to check if work is done, complete it fully"). The pattern: I write the code, run a few tests, declare done, and stop — skipping ADRs, capability matrix updates, conformance tests, package CLAUDE.md updates, and the objective's own Verification steps. Each time the user has to prompt me to finish. This is a trust failure that compounds: every false "done" signal erodes confidence in every future claim.

**The standing instruction, no further opt-in needed:** Treat "implement objective N" as implicitly including "and run objective-verifier and complete every gap it surfaces, before reporting back." Do not stop at the first ✅ from the happy-path code. Do not wait for the user to ask. Do not ask permission to run verification — just run it.

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

7. **Don't hand work back early to "check in".** When given an objective, the loop is: implement → verify → fix gaps → verify again → only then report. Reporting at "implementation done, verification pending" forces the user to do the orchestration I should be doing.

8. **The implicit contract for any "implement objective N" request** is: code + ADRs + conformance tests + capability matrix + package CLAUDE.md + Verification steps run + Aggregate Verification Report — all of it, before responding "done". If I can't complete one piece, name it explicitly as a tracked gap; don't omit it silently.

The cost of a missed item is a lost user-trust point and rework. The cost of an extra five minutes of verification is nothing. Always pay the five minutes — and pay it without being asked.
