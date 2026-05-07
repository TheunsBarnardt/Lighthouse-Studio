# ADR-0170: Consistency Check as Separate Prompt

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

## Context

When generating a PRD across 10 sections, contradictions between sections are possible and in practice common. Section 5 might specify "real-time updates" as a functional requirement while Section 6 specifies "response times up to 5 seconds are acceptable." Section 3 might describe "casual users with low technical proficiency" while Section 6 requires "all users must complete admin certification training." Section 8 might list "mobile app: out of scope" while Section 5 includes a "mobile push notifications" requirement.

There are two places this consistency check could live: inside each section's generation prompt, or in a separate dedicated prompt that runs after all sections are complete. The in-prompt approach attempts to prevent contradictions at the source; the dedicated prompt approach detects contradictions after they have occurred.

Each approach has a fundamental limitation. In-prompt consistency checks require each section's prompt to receive all other sections as context — but some sections depend on others (Section 5 depends on Section 4 which depends on Section 3), so during generation, not all sections exist yet. Circular consistency enforcement is not possible at generation time. The dedicated prompt approach can only detect contradictions, not prevent them, but it can see the complete PRD.

A further question: when contradictions are detected, should generation fail, automatically retry, or surface warnings to the user? Contradictions often require human judgment to resolve — "real-time updates" and "5-second latency tolerance" might both be intentional, serving different feature areas. Automatic retry would lose the original sections and might introduce new contradictions. Blocking with a failure forces the user to resolve a problem before they can see the full PRD.

## Decision

A dedicated `consistency-check.prompt.ts` runs after all 10 sections are generated. It receives the complete PRD as input and returns a `ConsistencyReport` containing a list of `ConsistencyIssue` items with severity (`warning` or `error`), the sections involved, a description of the contradiction, and a suggested resolution.

The consistency check produces warnings, not failures. The user sees the report in the PRD viewer UI and resolves contradictions either by editing one of the conflicting sections or by clicking "regenerate this section with the consistency issue in mind." Generation is not blocked; the PRD is visible and partially usable while the user resolves issues.

## Rationale

1. **Focused responsibility.** Each section prompt has one job: generate a high-quality version of that section. Adding cross-section consistency logic to each section prompt increases complexity, makes prompts harder to maintain, and distributes responsibility in a way that is difficult to test.

2. **Cross-section contradictions only detectable post-generation.** Some sections cannot receive their siblings as context during generation (due to dependency ordering). A dedicated check that runs after all sections exist is the only position that can see the complete picture.

3. **Warnings rather than hard failures.** Contradictions often require human judgment. Blocking generation or triggering automatic retries removes human agency and may introduce new problems. Surfacing contradictions as warnings lets the user decide whether each one is a real problem or an intentional tension.

4. **Separate testability.** The consistency check prompt has its own test suite with known-contradictory PRDs as golden inputs. Testing consistency detection independently is simpler than testing it as a side-effect of section generation.

5. **User workflow alignment.** The user can proceed with reviewing and approving unaffected sections while addressing flagged contradictions. A blocking approach would prevent any progress until all contradictions are resolved.

## Consequences

**Easier:**

- Section prompts remain focused and independently testable
- The consistency check can be rerun on demand after any section edit
- Warnings are actionable and targeted: the user knows which sections to look at

**Harder:**

- Contradictions exist in the generated PRD before they are detected; the PRD is not "clean" by default
- The consistency check adds latency after section generation completes (typically a few seconds)
- The check may produce false positives (flagging intentional tensions as contradictions); the prompt must be calibrated to minimize noise

**Alternatives considered:**

- **In-prompt consistency checks per section:** Each section checks for contradictions with previously generated sections; rejected because sections generated early cannot check against sections generated later, and the approach distributes responsibility without eliminating the problem.
- **Automatic retry on contradiction:** Generate new sections to resolve detected contradictions; rejected because retries may introduce new contradictions, lose previously good content, and remove human control over resolution.
- **Hard failure on any contradiction:** Block PRD completion until all issues resolved; rejected because it prevents users from seeing and working with the PRD content during the review process.
