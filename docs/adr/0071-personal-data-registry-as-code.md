# ADR-0071: Personal Data Registry as Code

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

GDPR Article 30 requires a Record of Processing Activities (RoPA) — a documented inventory of all personal data processed. GDPR Article 15 requires the platform to produce a complete copy of all data held about a specific individual on request. GDPR Article 17 requires erasing (or anonymizing) specific fields while retaining others.

All three requirements need the same underlying information: **what personal data is stored, where, and what the treatment is**.

Options:

1. Maintain a spreadsheet or document outside the codebase
2. Keep a compliance wiki page updated by the DPO
3. Encode it as structured data in the source code

The key insight is that the data subject access export and erasure workflows need to _programmatically query_ this registry. A document in Confluence or a spreadsheet cannot drive code — it becomes stale relative to the actual schema, and the export service has to be updated independently each time a new field is added.

## Decision

Maintain the personal data registry as a TypeScript constant in `packages/core/src/compliance/personal-data-registry.ts`.

Each entry describes:

- `location`: table.column or collection.field path
- `category`: type of personal data (contact, identity, authentication, etc.)
- `purpose`: why the field exists
- `legal_basis`: GDPR legal basis for processing
- `retention`: human-readable retention period
- `eraseable`: whether the field is deleted/anonymized on Article 17 erasure
- `erasure_method`: `'delete'` or `'anonymize'` for eraseable fields
- `notes`: optional explanation (especially for non-eraseable fields)

The registry is the authoritative source that drives:

- **Data subject access export**: `DataSubjectService.startAccessRequest()` walks the registry and queries each location
- **Erasure handling**: `DataSubjectService.startErasureRequest()` applies delete/anonymize per the registry
- **Compliance documentation**: `docs/compliance/personal-data-registry.md` is generated from the registry
- **CI check**: a heuristic that flags PRs adding columns with PII-adjacent names without updating the registry

The registry is committed alongside schema changes. When a new PII field is added to the schema, the registry is updated in the same PR.

## Consequences

### Positive

- Registry is always in sync with the actual schema — they live in the same repo, the same commit.
- Export and erasure code is driven by the registry; adding a new PII field automatically includes it in exports and erasure without changing service code.
- Compliance documentation is auto-generated; DPOs get an accurate picture without manual updates.
- Code review enforces registry completeness; reviewers can verify new PII fields are registered.
- Type-safe: `PersonalDataRecord` interface enforces all required fields; legal basis and category are typed enums.

### Negative

- The registry is code; non-technical DPOs cannot edit it directly. They must work through the engineering team. Mitigation: the auto-generated markdown document (`personal-data-registry.md`) is readable without engineering access.
- The CI heuristic (flag PII-adjacent column names) produces false positives (column named `customer_email_domain` is not PII) and false negatives (column named `bio` might be PII). The check is advisory, not blocking.
- Retention is expressed as a human-readable string (e.g., "until account deletion + 30 days") rather than a machine-computable duration. The erasure engine maps these strings to durations; they must be kept consistent.

### Neutral

- The registry covers the platform's own PII. Customers using the platform to build their own applications have additional PII obligations for their application data — those are outside this registry's scope. This is documented explicitly.

## Alternatives Considered

### Option A: External compliance document (spreadsheet or wiki)

Familiar to DPOs; no engineering involvement to update. Rejected because it cannot drive the export/erasure code. It would become stale relative to the actual schema. The platform would have to maintain both the document and the code, and they would diverge.

### Option B: Database-driven registry (admin UI to configure)

Runtime-configurable; DPO-friendly. Rejected because the registry must exist before the database does (it drives schema documentation) and because versioning becomes complex. A code-level registry has clean versioning via git, and is reviewable in PRs.

### Option C: Derive from database schema metadata (e.g., column comments)

Auto-detect PII fields from column annotations. Appealing for keeping things in sync. Rejected because column comments are a weak annotation mechanism (not well-supported across all three databases), and because purpose, legal basis, and erasure method cannot be reliably inferred from column names alone.

## References

- [ADR-0072: Anonymization vs. Deletion](./0072-anonymization-vs-deletion.md)
- [ADR-0073: Retention Default of 7 Years](./0073-retention-default-7-years.md)
- `packages/core/src/compliance/personal-data-registry.ts`
- `docs/compliance/personal-data-registry.md` — auto-generated output
- `packages/core/src/services/data-subject.service.ts`
