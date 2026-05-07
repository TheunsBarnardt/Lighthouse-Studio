# PRD Section Reference

Quick reference for each of the 10 sections in a Lighthouse Studio PRD. Each section is generated independently by the AI pipeline and reviewed by a human approver before the PRD moves downstream.

---

## 1. Overview

**Purpose:** Establishes the problem–solution frame that all downstream sections are anchored to.

**What the AI generates:** A concise summary of the product idea drawn from the approved Intent Brief. The AI articulates the specific problem being solved, describes the proposed solution in concrete terms, and enumerates the primary value propositions. It grounds the overview in background context so that a new reader understands the "why" without consulting the Intent Brief directly.

**Key fields:** `summary`, `background`, `problemStatement`, `proposedSolution`, `keyBenefits`

**Review checklist:**

- ✓ Problem statement names a specific, bounded pain — not a vague category
- ✓ Proposed solution is scoped to v1 and does not over-promise future phases
- ✓ Key benefits are measurable or at least falsifiable
- ✓ Background accurately reflects the intent brief without contradicting it

**Traceability note:** This section is the root anchor. Goals & Success Metrics, User Stories, and Functional Requirements all trace back to the `problemStatement` and `proposedSolution` fields defined here.

---

## 2. Goals & Success Metrics

**Purpose:** Converts the overview's aspirations into a prioritised, measurable list of outcomes the product must achieve.

**What the AI generates:** A numbered list of goals, each tagged with a MoSCoW priority (`must`, `should`, `nice-to-have`). For every goal the AI proposes a concrete success metric and a measurement method (analytics event, user survey, SLA check, etc.). An overarching success criterion ties all goals together into a single pass/fail statement for the release.

**Key fields:** `goals[].id`, `goals[].description`, `goals[].priority`, `goals[].successMetric`, `goals[].measurementMethod`, `goals[].tracesTo`, `overallSuccessCriteria`

**Review checklist:**

- ✓ Every `must` goal maps directly to a problem named in the Overview
- ✓ Success metrics specify a threshold, not just a direction (e.g. "≥ 80 % task-completion rate", not "improved completion")
- ✓ Measurement methods are feasible given the team's instrumentation capability
- ✓ `overallSuccessCriteria` would unambiguously tell a stakeholder whether the release succeeded

**Traceability note:** Each goal entry carries `tracesTo` refs pointing at the Intent Brief goals it originates from. The traceability check flags any Intent Brief goal that has no corresponding PRD goal.

---

## 3. Target Users & Personas

**Purpose:** Names the human actors whose workflows the product must serve, giving the team a shared vocabulary for the rest of the PRD.

**What the AI generates:** One or more persona entries derived from the intent brief's stakeholder descriptions. Each persona has a name, a narrative description, primary goals, pain points, technical proficiency level, and usage frequency. The AI designates one persona as primary — the one whose needs take precedence when there is a design conflict.

**Key fields:** `personas[].id`, `personas[].name`, `personas[].description`, `personas[].primaryGoals`, `personas[].painPoints`, `personas[].technicalProficiency`, `personas[].frequency`, `primaryPersona`, `marketSize`

**Review checklist:**

- ✓ Each persona is grounded in a real user type named in the intent brief — no invented personas
- ✓ Pain points are specific enough to generate concrete user story acceptance criteria
- ✓ Technical proficiency is calibrated to the actual audience (do not default everyone to `medium`)
- ✓ The primary persona designation aligns with the product's go-to-market focus

**Traceability note:** Persona IDs referenced in User Stories must match IDs declared here. A mismatch is caught by the consistency check.

---

## 4. User Stories

**Purpose:** Translates persona needs into discrete, testable units of work in the canonical "As a … I want … so that …" format.

**What the AI generates:** A set of user stories, each assigned to a persona ID, given a MoSCoW priority, and accompanied by Gherkin-style acceptance criteria (Given / When / Then). The AI assigns story point estimates where confidence is high and leaves them blank otherwise. Each story carries `tracesTo` refs linking it to the goals it serves.

**Key fields:** `stories[].id`, `stories[].persona`, `stories[].capability`, `stories[].benefit`, `stories[].formatted`, `stories[].acceptanceCriteria`, `stories[].priority`, `stories[].storyPoints`, `stories[].tracesTo`

**Review checklist:**

- ✓ Every `must`-priority story is traceable to a `must`-priority goal
- ✓ Acceptance criteria are written from the user's observable perspective — not implementation steps
- ✓ Each acceptance criterion has a single, unambiguous pass/fail condition
- ✓ No story's persona references an ID that does not exist in Section 3

**Traceability note:** Each story's `tracesTo` array should include at least one ref pointing at a goal from Section 2. Stories without any traceability links will be flagged by the traceability check.

---

## 5. Functional Requirements

**Purpose:** Specifies what the system must do at a level of detail sufficient for engineering estimation and test-plan authoring.

**What the AI generates:** A numbered catalogue of functional requirements (FR-1, FR-2, …), each with a title, description, MoSCoW priority, Gherkin acceptance criteria, and references to the user stories it implements. Requirements are written in the present tense ("The system shall…") and are scoped to observable system behaviour rather than implementation detail.

**Key fields:** `requirements[].id`, `requirements[].title`, `requirements[].description`, `requirements[].priority`, `requirements[].acceptanceCriteria`, `requirements[].tracesTo`, `requirements[].relatedStories`

**Review checklist:**

- ✓ Each requirement describes system behaviour observable at the interface — no internal implementation detail
- ✓ Every `must`-priority requirement has at least one acceptance criterion that can be automated
- ✓ `tracesTo` refs connect each requirement to the intent goals it satisfies
- ✓ No requirement is phrased as "the user can optionally…" — optional behaviour belongs in a separate `could`-priority requirement

**Traceability note:** The traceability check reports any intent goal that has no functional requirement tracing back to it. This is the primary gap indicator for downstream stages (schema design, UI generation, code generation).

---

## 6. Non-Functional Requirements

**Purpose:** Declares the quality attributes the system must exhibit — performance, security, scalability, and so on — with measurable thresholds.

**What the AI generates:** A set of NFRs grouped by category (`performance`, `security`, `scalability`, `usability`, `accessibility`, `reliability`, `maintainability`, `portability`). Each NFR pairs a description with one or more metric-based acceptance criteria specifying a threshold and measurement approach. The AI derives NFRs from constraints in the intent brief and from implied quality expectations (e.g. a customer-facing portal implies accessibility and performance requirements).

**Key fields:** `requirements[].id`, `requirements[].category`, `requirements[].title`, `requirements[].description`, `requirements[].acceptanceCriteria[].metric`, `requirements[].acceptanceCriteria[].threshold`, `requirements[].acceptanceCriteria[].measurement`, `requirements[].tracesTo`

**Review checklist:**

- ✓ Every threshold is a concrete number, not a relative term ("fast", "secure")
- ✓ Security NFRs cover authentication, authorisation, and data-at-rest/in-transit if the product handles user data
- ✓ Accessibility requirements cite WCAG level (AA minimum for any public-facing surface)
- ✓ Each measurement method is either automated (load test, static analysis) or has a named manual protocol

**Traceability note:** NFRs feed directly into the schema-design stage's indexing decisions and the code-generation stage's middleware selection. Vague or missing NFRs are a leading cause of downstream revision.

---

## 7. Constraints & Assumptions

**Purpose:** Makes explicit the boundaries within which the team must work and the beliefs the plan depends on — so both can be challenged before work begins.

**What the AI generates:** A list of constraints (fixed limits the team cannot change) and assumptions (beliefs the team is relying on that could be wrong). Constraints are typed (`technical`, `business`, `regulatory`, `resource`, `time`) and carry an impact statement. Assumptions carry a `riskIfWrong` field that prompts the team to validate each assumption before committing to dependent requirements. Dependencies on external systems or teams are listed separately.

**Key fields:** `constraints[].id`, `constraints[].type`, `constraints[].description`, `constraints[].impact`, `assumptions[].id`, `assumptions[].description`, `assumptions[].riskIfWrong`, `dependencies`

**Review checklist:**

- ✓ No constraint is listed that could actually be changed with stakeholder approval — distinguish genuine constraints from preferences
- ✓ Every assumption has a named owner who will validate it
- ✓ `riskIfWrong` is rated severe enough to warrant a corresponding risk entry in Section 10
- ✓ External system dependencies name the specific integration point (API, data feed, auth provider) — not just the vendor name

**Traceability note:** Constraints that impose capability restrictions on Section 5 or 6 should be cross-referenced by the relevant requirement's `tracesTo`. The Open Questions section (Section 9) should capture any constraint or assumption that has not yet been validated.

---

## 8. Out of Scope

**Purpose:** Prevents scope creep by explicitly naming what the v1 release will not deliver and why.

**What the AI generates:** A list of explicitly excluded features or capabilities, each with a rationale and an optional `deferredTo` label indicating when (if ever) it might be addressed. The AI derives out-of-scope items from any intent-brief content that was mentioned but not prioritised, plus common adjacent features that a reader might assume are included.

**Key fields:** `items[].id`, `items[].description`, `items[].rationale`, `items[].deferredTo`, `notes`

**Review checklist:**

- ✓ Every item named here was discussed in the intent-gathering process and consciously excluded — not silently omitted
- ✓ Rationale explains the business or technical reason for exclusion, not just "out of time"
- ✓ `deferredTo` labels use consistent terminology with the roadmap (e.g. objective numbers, version labels)
- ✓ Nothing in this list contradicts a `must`-priority requirement in Section 5

**Traceability note:** Out-of-scope items that are later promoted to in-scope trigger a staleness alert on all downstream sections. This list is a key input to the staleness-detection prompt.

---

## 9. Open Questions

**Purpose:** Surfaces unresolved decisions that could block design or engineering work if left unanswered.

**What the AI generates:** A numbered list of questions derived from ambiguities in the intent brief, gaps in the functional requirements, and unvalidated assumptions from Section 7. Each question carries an impact rating (`blocking`, `high`, `medium`, `low`), an optional owner, and a target resolution date. The AI flags blocking questions with particular urgency because they must be answered before the PRD is approved.

**Key fields:** `questions[].id`, `questions[].question`, `questions[].context`, `questions[].owner`, `questions[].dueDate`, `questions[].status`, `questions[].resolution`, `questions[].impact`

**Review checklist:**

- ✓ No `blocking` question is left unresolved when the PRD enters the approval workflow
- ✓ Every question names an owner — anonymous questions are not actioned
- ✓ Questions that were resolved during review have their `status` updated to `resolved` and a `resolution` populated
- ✓ Questions that cannot be resolved for v1 are moved to `deferred` with a rationale

**Traceability note:** Blocking questions with no resolution are a hard gate on PRD approval. The approval routing engine checks for unresolved blocking questions before allowing the PRD to move to `in_review`.

---

## 10. Risks & Mitigations

**Purpose:** Identifies what could go wrong, quantifies likelihood and impact, and commits the team to a mitigation strategy before work begins.

**What the AI generates:** A risk register derived from the constraints, assumptions, technical complexity, and open questions identified in earlier sections. Each risk entry has a probability rating (`low`, `medium`, `high`), an impact rating (`low`, `medium`, `high`, `critical`), a computed risk score, a mitigation strategy (what the team will do to reduce probability or impact), and an optional contingency plan (what to do if the risk materialises). The AI also assigns an overall risk rating for the PRD.

**Key fields:** `risks[].id`, `risks[].title`, `risks[].description`, `risks[].probability`, `risks[].impact`, `risks[].riskScore`, `risks[].mitigation`, `risks[].contingency`, `risks[].owner`, `risks[].relatedRequirements`, `overallRiskRating`

**Review checklist:**

- ✓ Every unvalidated assumption from Section 7 has a corresponding risk entry
- ✓ `riskScore` is consistent with the probability × impact matrix (high × high = critical, not medium)
- ✓ Mitigation strategies are concrete actions — not "monitor" or "be careful"
- ✓ `critical`-rated risks have a named owner and a contingency plan

**Traceability note:** Risk entries that reference requirement IDs in `relatedRequirements` allow downstream stages to annotate generated artefacts with risk context. A PRD with `overallRiskRating: critical` triggers a mandatory architect review before the pipeline advances.
