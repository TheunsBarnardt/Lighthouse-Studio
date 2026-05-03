# GDPR Control Matrix

_Status: Reviewed 2026-05-02. Review annually or when data processing activities change._

This document maps GDPR articles to platform features and capabilities. It is intended for customers' data protection officers (DPOs) and legal teams.

**Important:** This document covers the platform's own data processing as a data processor for its customers. Customers using the platform to build and operate their own applications have additional GDPR obligations related to their application's data — those are outside this document's scope.

---

## Chapter II — Principles

### Article 5 — Principles Relating to Processing

| Principle                          | Implementation                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Lawfulness, fairness, transparency | Legal basis documented per field in personal data registry                           |
| Purpose limitation                 | Fields collected only for documented purposes                                        |
| Data minimisation                  | Audit captures only what is needed; email snapshot only for forensics                |
| Accuracy                           | Users can update their own profile; email verification required                      |
| Storage limitation                 | Configurable retention policy; default 7 years (audit), shorter for operational data |
| Integrity and confidentiality      | Argon2id passwords; append-only audit; TLS in transit                                |
| Accountability                     | All processing documented in this registry; audit log provides evidence              |

---

## Chapter III — Rights of the Data Subject

### Article 12 — Transparent Information

The platform provides a customer-configurable privacy notice template (populated from the personal data registry) that covers all required Article 12 information.

### Article 13 / 14 — Information to be Provided

| Information                          | Source                                      |
| ------------------------------------ | ------------------------------------------- |
| Identity of controller               | Configured per installation (customer)      |
| Purposes and legal basis             | `docs/compliance/personal-data-registry.md` |
| Legitimate interests (if applicable) | Documented per field in registry            |
| Retention periods                    | Documented per field in registry            |
| Data subject rights                  | Covered in privacy notice template          |
| Right to lodge a complaint           | Covered in privacy notice template          |

### Article 15 — Right of Access

**Implementation:** `DataSubjectService.startAccessRequest()`

- User or installation admin initiates a request.
- Async worker assembles all data from every location in the personal data registry.
- Delivers a time-limited (7-day) encrypted download archive.
- Target: export ready within 24 hours (GDPR allows 30 days).
- The request itself is audited (`data.subject.access_requested`, `data.subject.access_completed`).

### Article 16 — Right to Rectification

User profile fields (email, display name) can be updated through standard platform UI. Email changes require verification.

### Article 17 — Right to Erasure ("Right to be Forgotten")

**Implementation:** `DataSubjectService.startErasureRequest()`

Erasure covers:

- User account immediately soft-deleted (cannot sign in)
- After grace period (default 30 days): hard-delete of eraseable fields per registry
- Non-eraseable fields (audit log): retained with documented legal justification

**What is NOT erased:**

- Audit log events (legal obligation; forensic record)
- References in audit events (anonymized, not deleted)
- Financial records (none currently; schema accommodates them)
- Records under legal hold

**Documentation:** The erasure record itself is an audit event (`data.subject.erasure_completed`), providing evidence of compliance.

### Article 18 — Right to Restriction of Processing

For legal hold scenarios: workspace legal hold flag pauses retention enforcement, which effectively restricts processing of data subject to the hold. Fine-grained per-subject restrictions are deferred until customer demand (see open questions in Objective 7).

### Article 20 — Right to Data Portability

The data subject access export (Article 15) produces a structured JSON archive, which constitutes machine-readable portability export.

### Article 21 — Right to Object

For processing based on legitimate interest (e.g., IP address in audit log): the platform documents the legitimate interest basis and the balance test. Users may object; DPOs must evaluate case-by-case.

---

## Chapter IV — Controller and Processor

### Article 24 / 25 — Controller Responsibilities / Data Protection by Design

- Data minimization: only necessary fields collected
- Default settings favor privacy (audit level configurable; elevated audit requires explicit opt-in)
- Personal data registry prevents undocumented PII collection (CI check)

### Article 28 — Processor Obligations

The platform's self-hosted deployment model means the **customer is the controller**. The platform vendor (Anthropic / the hosting entity) is not a processor in the self-hosted model — the customer controls all data.

If customers use the cloud-hosted variant: DPA terms apply. Contact legal.

### Article 32 — Security of Processing

| Measure                                  | Implementation                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Pseudonymisation                         | Erasure anonymizes rather than deletes where legally required                        |
| Encryption                               | TLS in transit; at-rest encryption is infrastructure-layer (customer responsibility) |
| Confidentiality, integrity, availability | RBAC; append-only audit; SLOs                                                        |
| Regular testing                          | Quarterly chain integrity drills; automated conformance tests                        |

### Article 33 / 34 — Breach Notification

The audit log provides the evidence trail needed for breach notification (who, what, when). The incident response runbook (`docs/runbooks/incident-evidence-preservation.md`) includes breach notification steps.

### Article 35 — Data Protection Impact Assessment (DPIA)

Customers should conduct a DPIA for their use of the platform, particularly for high-risk processing. This document provides the technical evidence needed for the DPIA.

---

## Chapter V — International Transfers

Data stays on customer infrastructure (self-hosted). No international transfers by the platform itself. Cold archive (optional) may involve cross-border storage — customers must ensure appropriate transfer safeguards.

---

## Key Contacts

- **DPO contact:** Configured per installation
- **Data subject rights requests:** Via platform UI (`/account/privacy`) or installation admin
- **Breach reporting:** Contact `installation_admin` role holders
