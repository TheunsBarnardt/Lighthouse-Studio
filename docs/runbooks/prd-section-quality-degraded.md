# Runbook: PRD Section Quality Degraded

**Trigger:** A specific section type is consistently rejected on first pass or requires many revisions before approval.

---

## Symptoms

- Section acceptance rate for a specific type drops below 50%
- Average revision count for a section exceeds 3
- Users report that a specific section "never gets it right on the first try"

## Investigation

1. Check quality signals dashboard: `ai.prd.section_generated` events, filter by `sectionType`
2. Identify whether the issue is isolated to specific intent brief shapes or universal
3. Review the audit log for `ai.prd.section_rejected` events on this section type — read the `rejectionFeedback` field
4. Pull a sample of the raw prompt output for the failing section type from the generation logs

## Resolution

1. If the rejection feedback points to a structural issue (wrong fields, wrong format): update the section's prompt system prompt rules
2. If the issue is context-related (section doesn't use upstream sections well): update the prompt's `userPromptTemplate` to pass more context
3. If the issue is a test gap: add a test case for the failing scenario to the section's prompt `.tests` array
4. Deploy the updated prompt; monitor acceptance rate for the next 48 hours

## Escalation

If quality does not improve after prompt iteration, escalate to AI pipeline team with:
- Sample intent briefs that trigger the failure
- Raw prompt outputs
- User rejection feedback text
