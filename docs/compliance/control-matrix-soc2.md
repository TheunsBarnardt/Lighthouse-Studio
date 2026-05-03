# SOC 2 Control Matrix

_Status: Reviewed 2026-05-02. Review annually or after architectural changes._

This document maps SOC 2 Trust Services Criteria (TSC) to platform features and capabilities.
It is intended to help customers' auditors understand the platform's control posture.

**Important:** The platform does not hold SOC 2 certification. Customers running self-hosted installations claim certifications for their use of the platform. This document provides the evidence references customers need for their own audits.

---

## CC1 — Control Environment

| Criterion                                                     | Platform Feature                                                                     | Evidence                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| CC1.1 Demonstrates commitment to integrity and ethical values | AGPL-3.0 license; open-source codebase                                               | [`LICENSE`](../../LICENSE), [`master-plan.md`](../../master-plan.md) |
| CC1.2 Board/management oversight                              | Out of scope (customer governance)                                                   | —                                                                    |
| CC1.3 Organizational structure                                | Documented roles: `installation_owner`, `installation_admin`, `installation_auditor` | ADR-0049, ADR-0051                                                   |
| CC1.4 Commitment to competence                                | Peer-reviewed code; CI gates; dependency security scanning                           | `.github/workflows/`                                                 |
| CC1.5 Accountability                                          | All actions attributed to authenticated actors in immutable audit log                | Objective 7; `audit_log` table                                       |

---

## CC2 — Communication and Information

| Criterion                       | Platform Feature                                     | Evidence                                                             |
| ------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| CC2.1 Uses relevant information | Audit log captures all state-changing operations     | [`docs/compliance/audit-event-catalog.md`](./audit-event-catalog.md) |
| CC2.2 Communicates internally   | Role-based notification routing                      | Objective 6                                                          |
| CC2.3 Communicates externally   | Customer-facing audit export (JSONL, CSV, CEF, LEEF) | `AuditPort.exportStream()`                                           |

---

## CC3 — Risk Assessment

| Criterion                          | Platform Feature                                                       | Evidence                                               |
| ---------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------ |
| CC3.1 Specifies objectives         | Defined in objective documents                                         | `objectives/`                                          |
| CC3.2 Identifies and analyzes risk | Threat model maintained alongside codebase                             | [`docs/compliance/threat-model.md`](./threat-model.md) |
| CC3.3 Assesses fraud risk          | Anti-patterns in objective docs; authorization on every service method | `objectives/07-audit-and-compliance.md` §11            |
| CC3.4 Change management risk       | Migration discipline; ADRs; CI gates                                   | ADR-0028, `.github/workflows/`                         |

---

## CC4 — Monitoring Activities

| Criterion                                     | Platform Feature                                            | Evidence                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| CC4.1 Evaluates controls                      | Quarterly chain integrity drill                             | [`docs/runbooks/audit-chain-integrity-drill.md`](../runbooks/audit-chain-integrity-drill.md) |
| CC4.2 Evaluates and communicates deficiencies | Verified chain results logged; runbooks document escalation | `ChainVerification.status`                                                                   |

---

## CC5 — Control Activities

| Criterion                                                   | Platform Feature                                           | Evidence                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- |
| CC5.1 Defines and develops controls                         | Objective documents define controls; CI enforces them      | `objectives/`                                   |
| CC5.2 Defines and develops general controls over technology | Dependency-cruiser boundary enforcement; strict TypeScript | `.dependency-cruiser.cjs`, `tsconfig.base.json` |
| CC5.3 Deploys controls through policies and procedures      | Operational runbooks                                       | `docs/runbooks/`                                |

---

## CC6 — Logical and Physical Access Controls

| Criterion                                      | Platform Feature                                                | Evidence                                    |
| ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| CC6.1 Restricts logical access                 | RBAC + lightweight ABAC; default-deny                           | ADR-0051, ADR-0052; `authorization.port.ts` |
| CC6.2 Manages access credentials               | Argon2id password hashing; TOTP MFA; database-backed sessions   | ADR-0030, ADR-0031, ADR-0032                |
| CC6.3 Identifies and authenticates users       | Built-in auth + external identity providers (Entra, OIDC, SAML) | Objective 5                                 |
| CC6.4 Considers network controls               | Out of scope for self-hosted (customer infrastructure)          | —                                           |
| CC6.5 Manages access for contractors           | Installation roles managed by installation_owner                | ADR-0050                                    |
| CC6.6 Restricts physical access                | Out of scope for self-hosted                                    | —                                           |
| CC6.7 Manages logical access for third parties | External identity providers integrated via ports                | Objective 5                                 |
| CC6.8 Prevents unauthorized access             | Append-only audit_log DB permissions; INSERT-only app_user      | ADR-0069; `0002_audit_log.sql`              |

---

## CC7 — System Operations

| Criterion                                 | Platform Feature                                                                 | Evidence                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------- |
| CC7.1 Detects and monitors anomalies      | Audit log queryable for anomaly detection; structured logging with OpenTelemetry | Objective 7; ADR-0019                             |
| CC7.2 Evaluates and responds to anomalies | Operational runbooks for incident response                                       | `docs/runbooks/incident-evidence-preservation.md` |
| CC7.3 Manages incidents                   | Audit log provides evidence trail for incident response                          | Objective 7 §6.10                                 |
| CC7.4 Manages business disruption         | Backup strategy documented                                                       | ADR-0016                                          |
| CC7.5 Manages change management           | Migration discipline; tagged releases; CI gates                                  | ADR-0028                                          |

---

## CC8 — Change Management

| Criterion                               | Platform Feature                                     | Evidence                              |
| --------------------------------------- | ---------------------------------------------------- | ------------------------------------- |
| CC8.1 Manages changes to infrastructure | Database migration runner with checksum verification | `persistence-postgres/src/migrate.ts` |

---

## CC9 — Risk Mitigation

| Criterion                                               | Platform Feature                                       | Evidence           |
| ------------------------------------------------------- | ------------------------------------------------------ | ------------------ |
| CC9.1 Identifies and assesses risks with vendors        | Dependency justification in commits (AGENTS.md policy) | `AGENTS.md`        |
| CC9.2 Manages risks associated with business disruption | Coolify orchestration; backup strategy                 | ADR-0017, ADR-0016 |

---

## A1 — Availability

| Criterion                        | Platform Feature                         | Evidence         |
| -------------------------------- | ---------------------------------------- | ---------------- |
| A1.1 Current processing capacity | SLO defined; error budget tracked        | ADR-0022         |
| A1.2 Security incidents          | Audit log + incident response runbook    | Objective 7      |
| A1.3 Recovery objectives         | Backup + restore runbooks; restore drill | `docs/runbooks/` |

---

## C1 — Confidentiality

| Criterion                                 | Platform Feature                                      | Evidence                                                                   |
| ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| C1.1 Identifies confidential information  | Personal data registry; PII tagging in audit metadata | [`docs/compliance/personal-data-registry.md`](./personal-data-registry.md) |
| C1.2 Disposes of confidential information | Retention enforcement + erasure service               | Objective 7 §6.5, §6.8                                                     |

---

## P-Series — Privacy

| Criterion                                            | Platform Feature                                          | Evidence                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| P1.1 Privacy notice                                  | Customer privacy notice template provided                 | (customer-configures)                                                      |
| P3.1 Collects only necessary personal information    | Personal data registry; minimal collection principle      | [`docs/compliance/personal-data-registry.md`](./personal-data-registry.md) |
| P4.1 Uses personal information for stated purposes   | Legal basis documented per field                          | Personal data registry `legal_basis` column                                |
| P5.1 Grants access to personal information           | GDPR Article 15 export service                            | `DataSubjectService.startAccessRequest()`                                  |
| P6.1 Discloses personal information to third parties | External identity providers disclosed in integration docs | Objective 5                                                                |
| P7.1 Protects personal information                   | Argon2id hashing; TLS in transit; append-only audit       | Objectives 5, 7                                                            |
| P8.1 Handles requests from individuals               | GDPR Article 15/17 implemented                            | `DataSubjectService`                                                       |
