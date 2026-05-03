# HIPAA Control Matrix

_Status: Reviewed 2026-05-02. Review annually or when platform capabilities change._

This document maps HIPAA Security Rule and Privacy Rule requirements to platform features.

**Important:** The platform is HIPAA-ready in its technical capabilities — it provides the controls a covered entity or business associate needs. However:

1. **The platform does not claim HIPAA compliance.** Compliance is a program, not a product feature.
2. **Customers using the platform in healthcare contexts must:**
   - Execute a Business Associate Agreement (BAA) if applicable
   - Conduct their own risk analysis (45 CFR § 164.308(a)(1))
   - Implement their own policies and procedures
   - Train their workforce
   - Ensure physical safeguards for their infrastructure

This document provides the technical control mapping customers' compliance officers need.

---

## Security Rule — Administrative Safeguards (§ 164.308)

| Standard                         | Implementation Status         | Platform Feature                                                  |
| -------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| Security management process      | ✅ Covered                    | Risk management in threat model; ADRs document security decisions |
| Assigned security responsibility | Partial (customer configures) | `installation_admin` / `installation_owner` roles                 |
| Workforce security               | ✅ Covered                    | RBAC; access control; audit of all access                         |
| Information access management    | ✅ Covered                    | Default-deny RBAC; workspace scoping; approval routing            |
| Security awareness and training  | Out of scope                  | Customer program                                                  |
| Security incident procedures     | ✅ Covered                    | Incident response runbook; audit trail for forensics              |
| Contingency plan                 | ✅ Covered                    | Backup strategy (ADR-0016); restore runbooks                      |
| Evaluation                       | Partial                       | Quarterly chain integrity drill; CI test suite                    |
| Business associate contracts     | Out of scope                  | Legal matter between customer and their BAs                       |

---

## Security Rule — Physical Safeguards (§ 164.310)

Physical safeguards are customer-infrastructure responsibilities in the self-hosted model. The platform provides:

- Deployment guides for secure infrastructure configuration
- No sensitive data in logs beyond what's documented in the personal data registry
- TLS required (Caddy reverse proxy configuration)

---

## Security Rule — Technical Safeguards (§ 164.312)

| Standard                                      | Implementation | Evidence                                                      |
| --------------------------------------------- | -------------- | ------------------------------------------------------------- |
| Access control (unique user IDs)              | ✅             | Every action attributed to authenticated user ID              |
| Access control (automatic logoff)             | ✅             | Session TTL configurable                                      |
| Access control (encryption / decryption)      | Partial        | TLS in transit; at-rest encryption is infrastructure layer    |
| Audit controls (hardware, software, activity) | ✅             | Immutable audit log with hash chaining; all access audited    |
| Integrity (authenticate data)                 | ✅             | Hash-chained audit log; versioned records; optimistic locking |
| Person or entity authentication               | ✅             | Multi-factor authentication (TOTP); external IdP support      |
| Transmission security                         | ✅             | TLS required; Caddy enforces HTTPS                            |

---

## Privacy Rule — Key Provisions

| Provision                  | Status  | Notes                                                               |
| -------------------------- | ------- | ------------------------------------------------------------------- |
| Minimum necessary standard | ✅      | Personal data registry documents necessity of each field            |
| Safeguards                 | ✅      | RBAC; audit; encryption                                             |
| Accounting of disclosures  | ✅      | Audit log records all data access                                   |
| Right of access (PHI)      | ✅      | Data subject access export (Article 15 mechanism reused)            |
| Amendment requests         | Partial | Profile updates supported; audit of original values retained        |
| Restrictions               | Partial | Legal hold mechanism; fine-grained per-subject restriction deferred |

---

## Elevated Audit for HIPAA (PHI Read Access)

HIPAA requires auditing read access to PHI (Protected Health Information), not just writes. The platform's default configuration audits only state-changing operations (writes, denials).

For HIPAA-context installations:

1. Enable elevated audit mode in workspace settings: `audit.level = 'elevated'`
2. Elevated mode also logs successful read operations for configured resource types
3. Note: elevated mode increases audit log volume significantly
4. The infrastructure is sized for it; plan for 3-5× normal audit log growth

Configuration option: `PLATFORM_AUDIT_LEVEL=elevated` (installation-level) or per-workspace via the admin UI.

---

## Minimum Necessary Access

The platform's RBAC system supports HIPAA's minimum necessary principle:

- Role permissions are scoped to specific actions and resource types
- Workspace scoping prevents cross-tenant access
- The `viewer` role provides read-only access without write capability
- Custom roles can further restrict to specific resource types

---

## Risk Analysis Guidance

For customers conducting HIPAA risk analysis, the following platform-specific risks should be assessed:

1. **Database access:** The database is the most sensitive component. Restrict database user privileges per `0002_audit_log.sql` (app_user has INSERT-only on audit_log).
2. **Backup security:** Database backups contain all PHI. Encrypt backups at rest and in transit.
3. **Audit log integrity:** Enable cold archive (optional) for tamper-proof audit evidence.
4. **Session management:** Set appropriate session TTLs for your risk tolerance.
5. **MFA enrollment:** Require MFA for all users with access to PHI.
