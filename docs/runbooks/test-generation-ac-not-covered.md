# Runbook: Acceptance Criterion Not Covered by Tests

## Symptoms

- AC appears in `uncoveredAcs` in the test plan
- `uncoveredMustAcs` in the coverage report contains must-have AC IDs
- Coverage panel shows uncovered must-ACs as high-priority gaps

## Steps

1. Review why the AC was marked as uncovered. Open the test plan and find the AC's reason:
   - "Requires manual verification" — the AC describes a non-automatable behaviour (e.g., visual design, physical hardware)
   - "AC is too vague to generate specific assertions" — the PRD needs clarification
   - "Requires third-party credentials not available in test environment" — an integration limitation

2. If the reason is "too vague": edit the PRD to add specific, measurable criteria for that AC, then regenerate the test plan.

3. If the reason is a third-party integration limitation (e.g., Stripe webhook):
   - For unit tests: mock the webhook payload and test the handler in isolation
   - Regenerate with feedback: "Generate a unit test that mocks the Stripe webhook event"

4. If the AC genuinely cannot be automated: add a manual test checklist entry in `docs/manual-test-checklists/<project>.md`.

5. Update the test plan to reflect the outcome (either AC is now covered, or manual checklist exists).

## Prevention

- Write ACs in "Given / When / Then" format in the PRD — this makes automation much more tractable
- Avoid ACs that reference subjective qualities ("the UI should look professional")
