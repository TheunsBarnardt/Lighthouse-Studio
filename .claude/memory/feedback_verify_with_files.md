---
name: Verification claims must cite concrete file evidence
description: Before reporting any objective item as ❌ or ⚠️, read the actual file and quote the absent code. Bare "not found" without evidence of having looked is not acceptable; this rule prevents 30+ min false-positive fix loops.
type: feedback
originSessionId: 07882865-3e79-446d-a02b-657d6f558e5a
---

When verifying objectives (directly or via subagent), every ❌ or ⚠️ in the report must come from reading a concrete file, not from pattern-matching the objective text or guessing.

**Why:** During the Objective 03 verification batch (2026-05-03), a subagent reported "DB adapter spans missing" without reading any of the three persistence adapter files. All three already used `withSpan('findById', ...)`. I almost spent 30+ minutes reimplementing what existed. A second subagent mis-quoted ADR-0042's _rejected alternative_ as the _decision_, manufacturing a "contradiction" that didn't exist. Both errors were preventable with one extra Read call. The user later flagged that false-completion claims erode trust faster than slow verification erodes patience.

**How to apply:**

1. **Before marking any DoD item or locked decision ❌ or ⚠️**, open the file that would contain the artefact with the Read tool. Bare Glob or Grep is not enough — Glob tells you a filename exists, not what's inside; Grep on a too-broad pattern can miss the actual idiom.

2. **Cite the absence concretely.** Good: "no `withSpan(` calls found in `packages/adapters/persistence-postgres/src/repository.adapter.ts:1-200` (read end-to-end)". Bad: "DB spans not found". The form forces you to actually look.

3. **Distinguish "doesn't exist" from "stub awaiting later objective".** A 3-line `export {};` file is a stub, not a missing file. Report it as "stub — wired up in Objective N" rather than "missing".

4. **Do not infer absence from the objective's prescriptive wording.** "The objective says X must exist" is a requirement, not evidence of absence. Read the file (or confirm it doesn't exist) first.

5. **Grep for the exact symbol, not loose keywords.** If the rule is "every service method calls authz.authorize", grep `authz\.authorize\(`, not the word "authorization".

6. **When verification is inconclusive,** mark the item ⚠️ with "needs hands-on verification — could not confirm from static reads", not ❌. ❌ is a strong claim; reserve it for items where you have evidence of absence.

7. **In subagent prompts**, repeat this requirement explicitly. Subagents inherit no context about why this matters; you have to remind them every time. Phrasing: "Do not mark any item as ❌ without first reading at least one concrete file that would contain the artefact and quoting the absent code."

8. **Spot-check every subagent ❌ before relaying it.** Subagents will ignore the rule even when told. On 2026-05-03 a four-agent verification sweep of Objectives 1–11 produced ~10 false ❌s (claimed-missing ADRs 0076–0078, identity/audit/schema runbooks, control matrices, threat model, customer-repo tests, lint rules) — every single one was on disk. Before producing the Aggregate Verification Report from subagent output, run a fast `ls`/`grep` pass on each ❌ to confirm. If the subagent reports something missing in a directory, list the directory yourself. Relaying false ❌s upstream is a worse trust failure than slow verification, because the user authorises follow-up work based on the report.
