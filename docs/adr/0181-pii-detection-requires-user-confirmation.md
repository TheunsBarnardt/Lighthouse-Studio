# ADR-0181: PII Detection Requires User Confirmation

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 24 (Stage 4: Schema Synthesis)

## Context

Columns containing Personally Identifiable Information (PII) need to be tagged for compliance (Objective 7). The AI can detect likely PII columns using heuristic patterns (column names like `email`, `phone`, `name`) and contextual judgment. The question is whether the AI's PII detections should be automatically accepted or require user confirmation.

## Decision

AI PII detections **require user confirmation**. The user sees each detection in the Schema Designer's PII Confirmation Panel and explicitly accepts, rejects, or modifies the PII category.

The detection is structured by confidence:
- **High confidence**: column name matches a strong heuristic (e.g., `email` in a `users` table)
- **Medium confidence**: contextual judgment (e.g., `notes` in a `contacts` table)
- **Low confidence**: weak signals

All detections are surfaced for confirmation regardless of confidence. Unconfirmed detections are shown as pending; the schema cannot be approved with pending detections.

## Consequences

**Better:**
- PII tagging is authoritative — it reflects the user's explicit intent, not AI guesses
- The user gains awareness of which columns are PII; this is valuable for compliance
- False positives (e.g., tagging a `name` column in a `tags` table as PII) are caught before they pollute compliance reports

**Worse:**
- For schemas with many columns, confirmation can feel tedious
- The approval gate blocks schemas with unconfirmed PII; users must address this before submitting

**Neutral:**
- Prior confirmations on re-synthesis runs can be re-applied (the confirmation record maps table name + column name, surviving table regeneration)

## Alternatives Considered

- **Auto-accept all detections** — rejected; false positives would silently create incorrect compliance records
- **User opt-in to PII tagging** — rejected; PII is mandatory to identify for GDPR compliance; making it opt-in creates compliance risk
- **Only show high-confidence detections** — rejected; medium-confidence detections are often correct; filtering reduces recall at the cost of false negatives
