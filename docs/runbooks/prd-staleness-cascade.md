# Runbook: PRD Staleness Cascade

**Trigger:** An intent brief change marks many sections stale; the user's approved work is largely invalidated.

---

## Symptoms

- User reports that editing one intent brief field flagged all 13 sections as stale
- `ai.prd.staleness_detected` shows `affectedSections: 13` (or close)
- User is frustrated that approved sections lost their status

## Investigation

1. Read the intent brief diff — how significant was the change?
2. Review the staleness-detection prompt output: which sections were flagged and why
3. Check whether the staleness-detection prompt is over-sensitive (flagging sections not logically connected to the changed field)

## Resolution

**If the change was genuinely structural** (e.g. project purpose changed, new primary user type added):
- The cascade is correct; guide the user through regenerating affected sections
- Use "Regenerate affected sections" which re-runs only flagged sections and preserves the rest

**If the staleness-detection prompt over-flagged:**
- Tighten the staleness-detection prompt: make section flagging conditional on the specific intent fields each section uses
- Re-run the detection after prompt update; confirm fewer sections are flagged

**Preventing future cascades:**
- Encourage users to lock the intent brief before starting PRD generation
- Document the relationship between intent brief fields and which PRD sections they affect

## User communication

Explain to the user: "Only the flagged sections need re-review; your approvals on unaffected sections are preserved."
