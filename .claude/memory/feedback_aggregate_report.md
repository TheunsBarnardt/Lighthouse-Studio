---
name: Always produce an Aggregate Verification Report after objective-verifier runs
description: After running objective-verifier (single or batched), aggregate findings into one structured report — verdict, gaps, blockers — before any other action.
type: feedback
originSessionId: 07882865-3e79-446d-a02b-657d6f558e5a
---

After every objective-verifier run, produce an Aggregate Verification Report. This is non-optional, including for single-objective runs.

**Why:** Verification output is dense per-objective. Without an aggregate, the user has to read multiple long reports to see the overall picture. The aggregate is what they actually use to decide "ship", "fix", or "defer". Skipping it pushes synthesis work onto the user. The user explicitly asked for this format on 2026-05-03 after a 13-objective verification batch.

**How to apply:**

1. **Always produce the aggregate**, whether the run covered 1 objective or 13. For a single-objective run, the aggregate is one row + a focused gap list — still useful.

2. **Use this exact structure:**

   ```
   # Aggregate Verification Report — Objective(s) <N>...

   **Headline verdict:** <COMPLETE / PARTIAL / NOT DONE / MIXED>

   ## Summary table
   | Obj | Title | Status | Critical issues |
   |---|---|---|---|

   ## Critical blockers
   <numbered list — runtime crashes, locked-decision violations, security gaps>

   ## Outstanding gaps (prioritized, non-blocker)
   <by objective; one-liner each>

   ## Recommended next step
   <one paragraph with concrete options for the user to choose from>
   ```

3. **Sort blockers by severity, not by objective number.** A runtime crash in Obj 04b ranks above a missing runbook in Obj 03.

4. **Be honest in the headline verdict.** If 4 of 13 are complete and 9 are partial, the headline is MIXED, not COMPLETE. Don't soften.

5. **End with a concrete recommendation** the user can answer with a single character or word. Don't ask open-ended questions when finite choices exist.

6. **Don't bury blockers in tables.** Critical issues get their own section above the table so they're impossible to miss.

7. **Skip the aggregate only if** the user explicitly says "just run it, no aggregate" — otherwise produce it every time.
