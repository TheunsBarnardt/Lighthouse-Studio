# Compliance Posture Review Report

**Date:** YYYY-MM-DD
**Reviewer:** (name — compliance background preferred; internal counsel, contracted compliance consultant, or experienced peer)
**Review method:** Reviewer requested evidence for each control matrix claim; inconsistencies between documents and actual platform behavior were flagged.
**Status:** PENDING — review not yet run

---

## SOC 2 Trust Services Criteria Review

Source: `docs/compliance/control-matrix-soc2.md`

| TSC Category                           | Controls | Evidence Verified | Gaps Found |
| -------------------------------------- | -------- | ----------------- | ---------- |
| CC1 – Control Environment              | —        | PENDING           | —          |
| CC2 – Communication and Information    | —        | PENDING           | —          |
| CC3 – Risk Assessment                  | —        | PENDING           | —          |
| CC4 – Monitoring of Controls           | —        | PENDING           | —          |
| CC5 – Control Activities               | —        | PENDING           | —          |
| CC6 – Logical/Physical Access Controls | —        | PENDING           | —          |
| CC7 – System Operations                | —        | PENDING           | —          |
| CC8 – Change Management                | —        | PENDING           | —          |
| CC9 – Risk Mitigation                  | —        | PENDING           | —          |
| A1 – Availability                      | —        | PENDING           | —          |

**Pass criteria:** Each control has specific evidence (which audit event, which config option, which code path). No claims without backing.

---

## GDPR Control Review

Source: `docs/compliance/control-matrix-gdpr.md`

| Requirement                              | Status  | Evidence | Gap |
| ---------------------------------------- | ------- | -------- | --- |
| Data subject access (Art. 15)            | PENDING | —        | —   |
| Data subject erasure (Art. 17)           | PENDING | —        | —   |
| Data portability (Art. 20)               | PENDING | —        | —   |
| Lawful basis documented per PII category | PENDING | —        | —   |
| Data retention periods enforced          | PENDING | —        | —   |
| Breach notification procedure            | PENDING | —        | —   |
| DPA with sub-processors documented       | PENDING | —        | —   |
| Privacy by design evidence               | PENDING | —        | —   |

**Pass criteria:** Data subject rights tested end-to-end (access and erasure exercised in staging). Legal basis documented for each PII category in the personal data registry.

### Data Subject Rights Test Results

- **Access request test:** PENDING — exercised in staging? Y/N; expected data returned?
- **Erasure request test:** PENDING — exercised in staging? Y/N; data actually removed?

---

## HIPAA Control Review

Source: `docs/compliance/control-matrix-hipaa.md`

| Rule          | Requirement                           | Status  | Evidence |
| ------------- | ------------------------------------- | ------- | -------- |
| Security Rule | Access controls (§164.312(a))         | PENDING | —        |
| Security Rule | Audit controls (§164.312(b))          | PENDING | —        |
| Security Rule | Integrity controls (§164.312(c))      | PENDING | —        |
| Security Rule | Transmission security (§164.312(e))   | PENDING | —        |
| Privacy Rule  | Minimum necessary use                 | PENDING | —        |
| Privacy Rule  | Individual rights (access, amendment) | PENDING | —        |

Note: HIPAA controls are only required if the platform is used to process PHI. If not applicable, mark N/A with rationale.

---

## Threat Model Review

Source: `docs/compliance/threat-model.md`

| Check                                      | Status  |
| ------------------------------------------ | ------- |
| Threat model reflects current architecture | PENDING |
| All identified threats have mitigations    | PENDING |
| New threats introduced since last review   | PENDING |
| STRIDE categories covered                  | PENDING |

---

## Personal Data Registry Review

Source: `docs/compliance/personal-data-registry.md`

| Check                                         | Status  |
| --------------------------------------------- | ------- |
| Registry matches current data model           | PENDING |
| All PII fields identified                     | PENDING |
| Retention periods specified for each category | PENDING |
| Legal basis specified for each category       | PENDING |

---

## Gaps Found and Remediation

| Gap       | Control | Severity | Remediation | Status |
| --------- | ------- | -------- | ----------- | ------ |
| (fill in) |         |          |             |        |

---

## Overall Gate Result

**PENDING**

All control matrix claims verified with evidence. Data subject rights tested end-to-end. Threat model current. Personal data registry matches data model.
