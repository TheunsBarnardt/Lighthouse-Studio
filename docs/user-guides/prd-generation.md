# PRD Generation — User Guide

## What is Stage 2 (PRD Generation)?

Stage 2 of the AI Build Pipeline takes your approved Intent Brief from Stage 1 and produces a **Product Requirements Document (PRD)** — the structured artifact that all later pipeline stages consume to generate your application's design, database schema, UI, and tests.

A PRD defines what your product does, who it serves, and what "done" looks like for each requirement. The platform generates it section by section, using focused AI prompts for each of the 10 standard sections. You review, edit, and approve each section independently, then the pipeline moves forward when all 10 are approved.

Stage 2 outputs one thing: a fully-approved PRD with traceable, testable requirements. That PRD is the input to Stage 3 (Design Tokens) and Stage 4 (Schema).

---

## How to Generate a PRD from an Approved Intent Brief

1. Open the AI Pipeline view and navigate to your project.
2. Confirm that your Intent Brief shows **Approved** status. PRD generation requires an approved brief.
3. Click **Generate PRD**. A template selector appears — choose a built-in template that matches your project type (CRM, blog, internal tool, etc.) or select **No template** to start from the intent alone.
4. Click **Start generation**. The platform generates all 10 sections in dependency order. Independent sections generate in parallel; the UI shows per-section progress.
5. Generation typically takes 2–5 minutes. You can navigate away — you will receive an in-app notification when all sections are ready.

---

## Understanding the 10 Sections

Every PRD has the same 10 sections in the same order. Downstream stages reference sections by type, so the set is fixed.

| #   | Section                     | What it contains                                                 |
| --- | --------------------------- | ---------------------------------------------------------------- |
| 1   | Overview                    | Summary, background, problem statement, proposed solution        |
| 2   | Goals & Success Metrics     | What success looks like; measurable targets per goal             |
| 3   | Target Users & Personas     | Who uses the product; their goals, pain points, technical level  |
| 4   | User Stories                | "As a [persona], I want [capability], so that [benefit]"         |
| 5   | Functional Requirements     | Numbered requirements (FR-1, FR-2, ...) with acceptance criteria |
| 6   | Non-Functional Requirements | Performance, security, scalability, accessibility targets        |
| 7   | Constraints & Assumptions   | Technical, business, and regulatory constraints                  |
| 8   | Out of Scope                | What is explicitly excluded, and why                             |
| 9   | Open Questions              | Unresolved questions that need answers before or during build    |
| 10  | Risks & Mitigations         | Identified risks with probability, impact, and mitigation plans  |

---

## How to Review, Approve, and Reject Sections

The PRD viewer has three panels:

- **Navigation panel (left):** lists all 10 sections with their status icons (pending, approved, rejected, stale)
- **Section view (centre):** shows the current section's content
- **Metadata panel (right):** shows reasoning, traceability, and version history for the current section

To review a section:

1. Click it in the navigation panel.
2. Read the content in the section view. The metadata panel shows the AI's reasoning for why it generated specific requirements.
3. To **approve**, click the **Approve** button. If your workspace has multi-person approval routing, the section routes to the configured approvers.
4. To **reject**, click **Reject** and enter feedback explaining what needs to change. The section returns to draft with your feedback visible.
5. To **edit** before approving, see the editing section below.

The PRD is considered fully approved when all 10 sections reach **Approved** status. Only then does it become available as input to Stage 3 and Stage 4.

---

## Editing a Section

### Structured view

Structured sections (Functional Requirements, Non-Functional Requirements, User Stories, etc.) render as individual cards — one card per requirement or story. You can:

- Edit any field within a card directly
- Add a new requirement by clicking **+ Add requirement**
- Remove a requirement by clicking the delete icon on its card
- Reorder requirements by drag-and-drop

### Markdown view

Free-form sections (Overview, Constraints & Assumptions, etc.) render in a markdown editor. You can also switch any section to the markdown view using the **View source** toggle. Edits in markdown are parsed back into structure when you switch back to structured view. If your edits break the expected format, a clear error message guides you to fix it.

Saving an edit creates a new version of the section. Previous versions are accessible in the metadata panel under **Version history**.

---

## Regenerating a Section with Feedback

If a section needs more than minor edits, you can ask the AI to regenerate it:

1. With the section open, click **Regenerate**.
2. In the dialog, enter optional feedback — for example: "Focus more on the checkout performance requirements" or "The personas are too generic; the intent brief describes a B2B audience."
3. Click **Regenerate section**. The AI receives your feedback, the original intent brief, and the current approved sections as context.
4. The new version appears in the section view. The previous version is preserved in version history.

Regenerating one section does not affect any other section or its approval state.

---

## Understanding the Consistency Check

After all 10 sections are generated, the platform automatically runs a **consistency check** — a separate AI pass that reads the complete PRD and looks for contradictions between sections. For example:

- Section 5 specifies "real-time updates" but Section 6 allows "up to 5 seconds latency"
- Section 8 lists "mobile app: out of scope" but Section 5 includes a mobile push notification requirement
- Section 3 describes "casual users" but Section 6 requires "all users must complete admin training"

Found issues appear as **warnings** in the consistency report, accessible via the **Consistency** tab in the metadata panel. Warnings identify which sections are in tension and suggest how to resolve each.

You resolve a warning by editing one of the conflicting sections or by clicking **Regenerate with conflict context** — this regenerates the section taking the contradiction into account.

Consistency warnings do not block section approval. You can approve sections while resolving warnings. You can also re-run the consistency check at any time after editing sections.

---

## Understanding the Traceability Matrix

Every functional requirement in your PRD traces back to specific goals or user inputs in your Intent Brief. This is captured in the `tracesTo` structural field on each requirement.

The **Traceability Matrix** view (accessible from the metadata panel) shows a grid of intent goals versus requirements. A filled cell means at least one requirement traces to that intent goal. An empty row means the AI didn't generate any requirements covering that goal — which may indicate a coverage gap.

After generation, the platform runs a **traceability check** that flags intent goals with no supporting requirements. These appear in the traceability report as gaps. You can address them by editing the relevant section to add a requirement, or by regenerating the section with a note to cover the missing goal.

---

## Exporting Your PRD

With one or more sections approved, you can export the PRD at any time:

1. Click **Export** in the top-right of the PRD viewer.
2. Choose **Markdown** — produces a well-formatted `.md` file with all sections in order, traceability preserved as inline references.
3. Click **Download**.

The markdown export reflects the current approved content. Sections still in draft are included with a `[DRAFT]` prefix. PDF export is available when the PDF generation service is active in your deployment.

---

## What Happens When Your Intent Brief Changes

If you modify your Intent Brief after generating a PRD, the platform detects which PRD sections are affected by the changes and marks them **stale**. Sections that depend on unchanged intent fields retain their approval state.

When staleness is detected:

1. A **Staleness** banner appears at the top of the PRD viewer.
2. Click the banner to open the **Staleness dialog**, which shows which sections are stale and which intent fields changed.
3. Click **Regenerate affected sections** to queue targeted regeneration of only the stale sections.
4. Review and approve the regenerated sections. Unchanged approved sections do not need re-approval.

This means a minor intent change (e.g., clarifying a goal description) regenerates 1–3 sections rather than the full PRD.

---

## Common Questions

**Why does PRD generation take 2–5 minutes?**
Each section is generated by a focused prompt, and some sections wait for their dependencies (Functional Requirements waits for User Stories; Risks waits for multiple other sections). Independent sections generate in parallel, but the longest dependency chain determines total time.

**Can I regenerate a section unlimited times?**
Yes, but each regeneration incurs AI cost. Your workspace has a monthly budget (visible in Workspace Settings). Per-section regeneration is cost-capped to prevent runaway iteration costs.

**What if I disagree with the AI's reasoning for a requirement?**
The metadata panel shows the AI's reasoning for each requirement. You can edit the requirement directly or add feedback when regenerating. The AI's reasoning is informational — you are always in control of the final content.

**Can two people review different sections simultaneously?**
Yes. Section approvals are independent. Two reviewers can approve different sections at the same time without conflicting. If two people edit the same section simultaneously, optimistic locking prevents silent overwrites — the second save will prompt for conflict resolution.

**Can I skip the consistency check?**
The consistency check runs automatically after generation and cannot be skipped. You can, however, approve sections while warnings are outstanding — warnings are advisory, not blocking.

**What does "stale" mean exactly?**
Stale means the section was generated from an earlier version of the intent brief, and the brief has since changed in a way that may affect that section's content. Stale does not mean wrong — it means the section needs a human to verify it still reflects current intent.
