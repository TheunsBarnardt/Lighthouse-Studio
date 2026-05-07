# ADR-0168: Acceptance Criteria in Gherkin-Influenced Format

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

## Context

Every functional requirement in a PRD must have acceptance criteria — the specific conditions that define "this requirement is satisfied." The format of those criteria matters both for human review and for downstream automated processing.

Three formats are common in practice: free text ("The user should be able to log in quickly and securely"), bullet points ("Must respond within 200ms", "Must support OAuth"), and Gherkin-style Given/When/Then ("Given a valid user session, When the user submits the form, Then the record is saved within 200ms"). Each format trades off between expressiveness, precision, and testability.

Free text is flexible but ambiguous — "quickly" is not a testable criterion. Bullet points are more precise but often omit context (the "given" state that must hold for the criterion to apply). Gherkin-style format is structured: it forces the author to specify the starting context, the triggering action, and the expected outcome. This structure makes criteria directly consumable by Stage 8 (Test Generation), which generates test code from acceptance criteria.

For non-functional requirements, the situation is different. NFR criteria are typically metric-based: "p95 latency under 200ms measured across 1000 requests" does not fit naturally into a Given/When/Then structure. A separate metric-based format is more honest for NFRs.

## Decision

Functional requirements (FRs and User Stories) use Gherkin-influenced Given/When/Then acceptance criteria:

```typescript
interface AcceptanceCriterion {
  id: string; // 'AC-1', 'AC-2', etc.
  given: string; // context/precondition
  when: string; // triggering action
  then: string; // expected outcome
}
```

Every FR and User Story must have at least one `AcceptanceCriterion`. This is enforced at the zod schema level (`.min(1)`).

Non-functional requirements use a separate metric-based format:

```typescript
interface MetricAcceptanceCriterion {
  id: string;
  metric: string; // what is being measured
  threshold: string; // the pass/fail threshold
  measurement?: string; // how and under what conditions
}
```

## Rationale

1. **Testability.** Given/When/Then criteria can be verified by a human QA tester following the steps literally, or by Stage 8's test generation prompt, which reads the criteria and produces executable test cases. Free text cannot be mechanically transformed into tests.

2. **Elimination of ambiguity.** The three-field structure forces the author (and the AI) to specify the initial state, the action, and the expected result as distinct pieces. It is harder to write a vague Given/When/Then criterion than a vague sentence.

3. **Direct Stage 8 consumption.** Test Generation (Stage 8) reads acceptance criteria from the PRD to produce test suites. Structured criteria with known field names (`given`, `when`, `then`) allow Stage 8's prompt to reliably extract and transform them. Unstructured text would require NLP parsing with higher error rates.

4. **Industry standard.** Given/When/Then is widely understood by software teams. Reviewers know what each field means; it reduces onboarding cost for teams new to structured PRDs.

5. **Honest NFR format.** Forcing NFRs into Given/When/Then produces awkward, artificial criteria. "Given the system is under normal load, When an API call is made, Then it should respond quickly" is less useful than "p95 latency < 200ms, measured across 1000 requests at 50 concurrent users." The metric format matches how NFRs are actually specified and verified.

## Consequences

**Easier:**

- Stage 8 (Test Generation) consumes acceptance criteria with a reliable structure
- Human QA testers can follow criteria as test scripts without interpretation
- The AI generation prompt can be given clear instructions ("every criterion must have non-empty given, when, and then fields")
- Coverage analysis can count criteria per requirement

**Harder:**

- Teams accustomed to free-text acceptance criteria need to adapt their review process
- Some edge-case requirements don't fit naturally into Given/When/Then (e.g., "The system must comply with GDPR"); these need careful phrasing or belong in constraints rather than FRs
- The AI must be prompted carefully to avoid generating trivial or repetitive criteria

**Alternatives considered:**

- **Free text acceptance criteria:** Maximum flexibility; rejected because untestable by machines and often ambiguous for humans. Stage 8 cannot reliably generate tests from narrative text.
- **Bullet-point criteria:** More structured than free text; rejected because it omits the precondition ("given") context, which is essential for test generation and unambiguous human verification.
- **Full Gherkin with `And`, `But`, scenarios and scenario outlines:** More expressive; rejected because the additional complexity is unnecessary for PRD-level criteria, which should be high-level. Full Gherkin belongs in the test suite, not in the PRD.
