# PRD Generation Guide (Stage 2)

PRD Generation is Stage 2 of the AI Build Pipeline. It takes an approved Intent Brief (Stage 1) and produces a structured 13-section Product Requirements Document.

---

## Prerequisites

- An Intent Brief must be in **Approved** status before you can generate a PRD from it.
- Navigate to **AI Pipeline → Intent Capture** to check your brief's status.

---

## Starting a PRD

1. From the PRD Generation list page, click **Generate PRD**.
2. Select an approved intent brief from the list.
3. Optionally choose a **template** (CRM, Blog, Internal Tool, etc.) to seed section hints.
4. Click **Generate** — the system generates all 13 sections in dependency order.

Generation typically takes 2–5 minutes. The progress indicator shows which section is being generated.

---

## Reviewing Sections

The PRD viewer shows a **13-section navigation panel** on the left. Each section has a status icon:

| Icon | Meaning |
|------|---------|
| ○ | Not yet generated |
| ⟳ | Generating |
| ● | Draft (needs review) |
| ⏱ | Awaiting approval |
| ✓ | Approved |
| ✗ | Rejected |

Click a section to view and approve it.

---

## Approving a Section

Click **Approve** to approve the current section. In solo workspaces, your approval counts immediately. In team workspaces, the configured approvers must approve before the section is marked complete.

The PRD is **Fully Approved** when all 13 sections are approved.

---

## Regenerating a Section

If a section isn't right, click **Regenerate**. You can optionally provide feedback:

> *"Make the tone more formal and add more detail about the payment flow."*

The regeneration uses your feedback alongside the other approved sections to produce a revised version. Approved sections are not touched.

---

## Running Quality Checks

Click **Run Checks** to run the **consistency check** and **traceability check**:

- **Consistency check** — detects contradictions between sections (e.g. a feature in Scope that is refused in Anti-Patterns)
- **Traceability check** — verifies every intent brief goal has at least one corresponding PRD element

Issues appear in the right panel. Warnings are non-blocking; you can proceed with known warnings if you judge them acceptable.

---

## Staleness

If the intent brief is updated after the PRD is generated, a **Stale** banner appears. Click **Check Staleness** to identify which sections are affected. You can then regenerate only the stale sections — unaffected sections keep their approvals.

---

## Exporting the PRD

Click **Export → Download Markdown** to download the full 13-section PRD as a Markdown file for sharing with stakeholders or archiving.

---

## What Comes Next

Once all 13 sections are approved, the PRD is ready to feed:

- **Stage 3: Design Tokens** — visual language derived from the PRD
- **Stage 4: Schema Synthesis** — database schema from the PRD's component specs
- **Stage 6: UI Generation** — components from tokens and schema
- **Stage 7: Code Generation** — server logic from component specifications and ADRs

The **What Comes Next** section (Section 13) in your PRD lists the specific dependencies for the next stage.

---

## Templates

The following built-in templates are available:

| Template | Best for |
|----------|---------|
| CRM | Contact management, deal pipelines, sales tools |
| Blog / Content Platform | Publishing, authors, comments, moderation |
| Internal Business Tool | Employee workflows, approvals, internal data |
| Customer Portal | Self-service account management, support tickets |
| Analytics Dashboard | Charts, metrics, scheduled reports |
| E-Commerce Store | Product catalog, cart, checkout, orders |

Templates are hints, not constraints — the AI uses them to seed section emphasis and adjusts based on your actual intent brief.

---

## Cost

PRD generation typically costs **$1–$5** across all 13 sections. Cost is tracked per section and visible in the workspace usage dashboard.
