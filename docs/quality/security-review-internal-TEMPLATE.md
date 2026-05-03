# Internal Security Review Report

**Date:** YYYY-MM-DD
**Reviewer:** (maintainer name)
**Methodology:** OWASP ASVS Level 2 + OWASP Top 10 (Web) + OWASP API Security Top 10
**Automated scanning:** OWASP ZAP vX.X / Burp Community vX.X
**Status:** PENDING — gate not yet run

---

## OWASP ASVS Level 2 Checklist Summary

Full checklist at: (link to separate checklist spreadsheet or appendix)

| Category                                | Controls Total | Pass | Fail | N/A |
| --------------------------------------- | -------------- | ---- | ---- | --- |
| V1 Architecture                         | —              | —    | —    | —   |
| V2 Authentication                       | —              | —    | —    | —   |
| V3 Session Management                   | —              | —    | —    | —   |
| V4 Access Control                       | —              | —    | —    | —   |
| V5 Validation / Sanitization / Encoding | —              | —    | —    | —   |
| V6 Cryptography                         | —              | —    | —    | —   |
| V7 Error Handling / Logging             | —              | —    | —    | —   |
| V8 Data Protection                      | —              | —    | —    | —   |
| V9 Communication                        | —              | —    | —    | —   |
| V10 Malicious Code                      | —              | —    | —    | —   |
| V11 Business Logic                      | —              | —    | —    | —   |
| V12 Files and Resources                 | —              | —    | —    | —   |
| V13 API and Web Service                 | —              | —    | —    | —   |
| V14 Configuration                       | —              | —    | —    | —   |
| **Total**                               | ~150           | —    | —    | —   |

**Pass criteria:** 100% pass or N/A with documented justification. Zero unexplained fails.

---

## OWASP Top 10 (Web App) — 2021

| #   | Category                               | Status  | Evidence |
| --- | -------------------------------------- | ------- | -------- |
| A01 | Broken Access Control                  | PENDING | —        |
| A02 | Cryptographic Failures                 | PENDING | —        |
| A03 | Injection                              | PENDING | —        |
| A04 | Insecure Design                        | PENDING | —        |
| A05 | Security Misconfiguration              | PENDING | —        |
| A06 | Vulnerable/Outdated Components         | PENDING | —        |
| A07 | Identification/Authentication Failures | PENDING | —        |
| A08 | Software/Data Integrity Failures       | PENDING | —        |
| A09 | Security Logging/Monitoring Failures   | PENDING | —        |
| A10 | Server-Side Request Forgery            | PENDING | —        |

---

## OWASP API Security Top 10 — 2023

| #     | Category                                        | Status  | Evidence |
| ----- | ----------------------------------------------- | ------- | -------- |
| API1  | Broken Object Level Authorization               | PENDING | —        |
| API2  | Broken Authentication                           | PENDING | —        |
| API3  | Broken Object Property Level Authorization      | PENDING | —        |
| API4  | Unrestricted Resource Consumption               | PENDING | —        |
| API5  | Broken Function Level Authorization             | PENDING | —        |
| API6  | Unrestricted Access to Sensitive Business Flows | PENDING | —        |
| API7  | Server Side Request Forgery                     | PENDING | —        |
| API8  | Security Misconfiguration                       | PENDING | —        |
| API9  | Improper Inventory Management                   | PENDING | —        |
| API10 | Unsafe Consumption of APIs                      | PENDING | —        |

---

## Automated Scanning Results

### OWASP ZAP

- Scan profile: (e.g., active scan, authenticated)
- High findings: —
- Medium findings: —
- Low findings: —
- Informational: —
- Report file: (attach or reference)

### Burp Community

- Scan profile: —
- High findings: —
- Medium findings: —
- Low findings: —
- Report file: (attach or reference)

---

## Credential Leak Check

24 hours of load-test logs reviewed for credential patterns (passwords, API keys, tokens in log output).

- Review window: YYYY-MM-DD HH:MM – YYYY-MM-DD HH:MM
- Findings: PENDING

---

## Findings Log

| ID        | Category | Severity | Description | Status | Remediation |
| --------- | -------- | -------- | ----------- | ------ | ----------- |
| (fill in) |          |          |             |        |             |

**Pass criteria:** Zero critical or high findings unaddressed. Medium findings either remediated or explicitly accepted with rationale.

---

## Overall Gate Result

**PENDING**
