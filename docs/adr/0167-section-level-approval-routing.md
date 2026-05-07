# ADR-0167: Section-Level Approval Routing

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

---

## Context

A PRD is too large to approve as a single unit. Reviewers have different expertise and availability — a BA reviews user-facing sections; an architect reviews technical ones. We need to decide the approval granularity.

## Decision

Approval routing operates at the **section level**. Each section type can be configured with its own set of approvers and approval mode (`any_of` or `all_of`). The PRD is considered "fully approved" when all 13 sections are approved.

In solo workspaces the workspace owner approves all sections; one click per section.

## Consequences

**Positive:**
- BA and architect can approve their respective sections independently without waiting for each other
- A rejected section does not block approval of unrelated sections
- Granularity matches real enterprise review workflows

**Negative:**
- Users must approve 13 sections instead of 1 document
- The approval routing configuration must be maintained per workspace

**Neutral:**
- The same approval engine used in Objective 6 powers this; no new infrastructure required
