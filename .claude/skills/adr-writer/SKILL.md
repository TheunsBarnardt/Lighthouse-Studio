---
name: adr-writer
description: Use this skill whenever an architectural decision needs to be documented. Trigger on phrases like "write an ADR", "create an ADR", "document this decision", "add an ADR for", "ADR for X", or when the user finalizes a non-trivial design choice that affects how future code is structured. Also trigger when implementing an objective that lists ADRs to write — proactively surface those ADRs are needed before declaring the objective done. Auto-discovers the next ADR number, copies the template, fills in context/decision/consequences/alternatives based on conversation context, and links to related ADRs and objectives.
---

# ADR Writer

ADRs (Architectural Decision Records) capture the **why** behind decisions so future readers (including future-you) understand the reasoning. Lighthouse Studio uses sequential ADR numbering across the entire repo (currently at 0082+). This skill ensures ADRs are created consistently and at the right number.

## When to use

- An objective lists ADRs to write — write them as part of the objective's work, not "later"
- A non-trivial design decision was just made in conversation (database choice, error model, abstraction boundary, test strategy)
- The user explicitly asks to document a decision
- A PR description mentions a decision that has no ADR yet

## When NOT to use

- Trivial style choices (formatter config, naming convention for one variable)
- Decisions that are already covered by an existing ADR (check first)
- Implementation details that don't affect future architecture
- Things that should go in a `CLAUDE.md` or runbook instead

If unclear whether a decision warrants an ADR, ask: "Will a future engineer touching this area need to know _why_ this was chosen?" If yes, write the ADR. If no, skip it.

## How to use

### Step 1: Find the next ADR number

```
Glob: docs/adr/*.md
```

The highest existing number + 1 is the next ADR number. Format with leading zeros to 4 digits (e.g., `0083`).

If multiple ADRs are being written in one session, increment sequentially as you go.

### Step 2: Check for duplication

Before writing, search existing ADRs for the same decision:

```
Grep: <decision keywords> in docs/adr/*.md
```

If a closely related ADR exists, decide:

- **Supersedes**: The new decision replaces the old one. Mark the old ADR as `Superseded by ADR-NNNN`. Reference it in the new ADR's Context.
- **Refines**: The new ADR adds detail without contradicting. Reference it; both stay Accepted.
- **Already covered**: Don't write a duplicate. Update the existing ADR if it needs amendment.

### Step 3: Use the template

Copy `docs/adr/0000-template.md` to `docs/adr/<NNNN>-<slug>.md`.

The slug:

- All lowercase
- Hyphen-separated
- Concise (3–6 words typically)
- Describes the decision, not the problem (e.g., `argon2id-with-versioning`, not `password-hashing-discussion`)

### Step 4: Fill in the sections

**Title** — `# ADR-NNNN: <Title in Title Case>`. Title is short and declarative ("Use Argon2id with Versioning", not "How to hash passwords").

**Status** — `Proposed` initially; flip to `Accepted` when the PR merges.

**Date** — Today's date in `YYYY-MM-DD`.

**Deciders** — `solo` (this is a solo project per CLAUDE.md) unless context indicates otherwise.

**Context** — What's the situation; why is a decision needed? Frame the _forces_ — competing constraints, prior decisions that limit options, requirements that must be met. 2–4 paragraphs.

**Decision** — What's the decision? State it declaratively, in present tense ("We use X" not "We will use X"). 1–3 paragraphs. Be specific enough that a reader could implement it.

**Consequences** — What changes; what becomes harder; what becomes easier? Three sub-sections:

- **Positive** — what we gain
- **Negative** — what we accept as cost
- **Neutral** — implications that are neither pro nor con but matter

Be honest about the negatives. ADRs that only list positives are sales pitches, not decisions.

**Alternatives Considered** — What other options were evaluated; why rejected? At least two alternatives, each with a short Pros/Cons. If only one option was actually considered, the ADR is probably premature — the decision hasn't been thought through.

**References** — Links to related ADRs (`ADR-NNNN`), the relevant objective (`Objective N`), external articles, prior art, RFCs.

### Step 5: Cross-link

Update related artifacts:

- The objective document referenced by this ADR may have a list of ADRs to write — note this one is now written.
- If superseding an old ADR, update the old ADR's Status to `Superseded by ADR-NNNN`.
- If a `CLAUDE.md` references the area, consider whether to add a pointer.

### Step 6: Stage in git

ADRs land with the implementation that uses them, not as a separate PR. Add the new file to staging when committing the related work.

## Writing quality bar

ADRs are short — typically 1–3 pages. They're read more than they're written, so clarity matters.

**Good ADRs:**

- Lead with the decision in the title and Decision section
- Explain the _why_ in Context, not just the _what_
- Are honest about negatives
- Cite specific alternatives, not strawmen
- Link to related ADRs

**Bad ADRs:**

- Bury the decision in walls of context
- Skip alternatives because "we already knew what we wanted"
- Treat ADR-writing as paperwork (vague language, missing reasoning)
- Duplicate prior ADRs because the author didn't search first

## Examples

**Example 1: Objective references ADR**

User says: "I'm starting on Objective 12 (REST APIs). It mentions ADR-0058 should cover pagination strategy."

Action:

1. Glob `docs/adr/0058-*.md` — confirm it doesn't exist.
2. Copy template to `docs/adr/0058-cursor-pagination-as-default.md`.
3. Fill in based on Objective 12's locked decisions on pagination.
4. Cite Objective 12 and any prior pagination-related ADRs in References.

**Example 2: Decision made in conversation**

User says: "Let's use OpenTelemetry's W3C trace context, not Zipkin's B3."

Action:

1. Search `docs/adr/*.md` for "trace context" — confirm not duplicated.
2. Find next number (e.g., 0083).
3. Write `docs/adr/0083-w3c-trace-context-over-b3.md`.
4. Context: explain why this came up (cross-system propagation requirement).
5. Decision: W3C trace context.
6. Consequences: ✅ standards-aligned, vendor-neutral; ❌ legacy systems on B3 need a translation layer.
7. Alternatives: B3 (Zipkin), Jaeger native — with concrete rejection reasons.
8. References: Objective 3 (observability foundation), ADR-0019 (OpenTelemetry as standard).

## Anti-patterns to refuse

- **Skipping numbering check.** Always Glob existing ADRs first. Number collisions break the sequence.
- **Writing an ADR for an implementation detail.** "We chose this variable name" is not an ADR.
- **Vague Decision sections.** "We use a flexible approach" tells the reader nothing. Be specific.
- **Inventing alternatives that weren't real options.** If you only ever considered one option, say so honestly in the Context — don't pad Alternatives with strawmen.
- **Skipping Negative Consequences.** Every decision has tradeoffs. An ADR that pretends otherwise is dishonest documentation.
