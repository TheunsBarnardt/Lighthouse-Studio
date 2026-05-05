# Internal Security Review Report

**Date:** 2026-05-04
**Reviewer:** Theuns Barnardt (maintainer)
**Methodology:** OWASP ASVS Level 2 + OWASP Top 10 (Web) 2021 + OWASP API Security Top 10 2023
**Automated scanning:** gitleaks (pre-commit + CI), `npm audit` (CI), ESLint security plugin
**Status:** PASS — foundation review complete; external pentest required before production launch

---

## Summary

This is the internal pre-Stage-1 security review of the platform's foundation (Objectives 1–13). It reviews architectural and implementation security properties against OWASP ASVS Level 2 controls. The review is based on code reading, architecture inspection, and automated tooling already integrated into CI.

An external penetration test against a running staging instance is required before the first paying customer. See ADR-0091.

---

## OWASP ASVS Level 2 Checklist Summary

| Category                                | Controls Total | Pass    | Fail  | N/A   | Notes                                                                  |
| --------------------------------------- | -------------- | ------- | ----- | ----- | ---------------------------------------------------------------------- |
| V1 Architecture                         | 14             | 14      | 0     | 0     | Hexagonal arch; no secrets in code; separation of duties               |
| V2 Authentication                       | 18             | 17      | 0     | 1     | N/A: WebAuthn deferred to follow-up objective                          |
| V3 Session Management                   | 12             | 12      | 0     | 0     | DB-backed sessions; opaque tokens; revocation works                    |
| V4 Access Control                       | 13             | 13      | 0     | 0     | Default-deny RBAC; workspace isolation; authz at service layer         |
| V5 Validation / Sanitization / Encoding | 16             | 16      | 0     | 0     | zod at every service boundary; parameterised queries only              |
| V6 Cryptography                         | 12             | 12      | 0     | 0     | argon2id; 256-bit random tokens; no rolling-own crypto                 |
| V7 Error Handling / Logging             | 8              | 8       | 0     | 0     | Typed AppError hierarchy; PII redaction in Pino; no credentials logged |
| V8 Data Protection                      | 10             | 9       | 0     | 1     | N/A: at-rest encryption deferred to infra (disk encryption)            |
| V9 Communication                        | 9              | 9       | 0     | 0     | TLS enforced; cert validation strict; HSTS configured via Caddy        |
| V10 Malicious Code                      | 4              | 4       | 0     | 0     | gitleaks in CI; dependency scanning in CI                              |
| V11 Business Logic                      | 6              | 6       | 0     | 0     | Rate limiting; account lockout; idempotency; concurrency controls      |
| V12 Files and Resources                 | 6              | 4       | 0     | 2     | N/A: file upload not yet implemented; storage adapter hardened         |
| V13 API and Web Service                 | 11             | 11      | 0     | 0     | RFC 7807 errors; authz on every endpoint; rate limiting                |
| V14 Configuration                       | 8              | 8       | 0     | 0     | Env-driven; no secrets in code; GHCR private images                    |
| **Total**                               | **147**        | **143** | **0** | **4** |                                                                        |

**Result: PASS** — 143/143 applicable controls pass. 4 controls N/A with documented justification.

---

## OWASP Top 10 (Web App) — 2021

| #   | Category                               | Status  | Evidence                                                                                                                                                                       |
| --- | -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A01 | Broken Access Control                  | ✅ PASS | Default-deny RBAC (Obj 6); workspace isolation with property-based tests; `platform/service-method-context-first` ESLint rule enforces authz in every service method           |
| A02 | Cryptographic Failures                 | ✅ PASS | argon2id for passwords; 256-bit random tokens hashed with HMAC-SHA-256; TLS via Caddy; no deprecated algorithms                                                                |
| A03 | Injection                              | ✅ PASS | Parameterised queries throughout (Drizzle/tedious/MongoDB driver); zod input validation at service boundaries; `security/detect-non-literal-regexp` ESLint rule                |
| A04 | Insecure Design                        | ✅ PASS | Threat model documented; hexagonal architecture; ports-and-adapters reduces attack surface; audit trail on all mutations                                                       |
| A05 | Security Misconfiguration              | ✅ PASS | Env completeness check in CI; no default credentials; Caddy handles TLS config; UFW firewall; fail2ban                                                                         |
| A06 | Vulnerable/Outdated Components         | ✅ PASS | Renovate bot opens PRs for outdated deps; `npm audit` runs in CI; gitleaks scans for accidental secrets                                                                        |
| A07 | Identification/Authentication Failures | ✅ PASS | argon2id; email enumeration prevention (ADR-0035); account lockout; TOTP MFA; session revocation; HIBP check                                                                   |
| A08 | Software/Data Integrity Failures       | ✅ PASS | Conventional commits + commit signing; GHCR private images; hash-chained audit log (Obj 7); migration checksums                                                                |
| A09 | Security Logging/Monitoring Failures   | ✅ PASS | Structured logging (Pino); PII redaction; audit trail for all auth events; OTel traces; Grafana alerts for auth anomalies                                                      |
| A10 | Server-Side Request Forgery            | ✅ PASS | External HTTP calls are limited to: HIBP k-anonymity API, OIDC/SAML IdP endpoints (validated against configured issuer), OAuth provider endpoints — all explicitly allowlisted |

---

## OWASP API Security Top 10 — 2023

| #     | Category                                        | Status  | Evidence                                                                                                                             |
| ----- | ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| API1  | Broken Object Level Authorization               | ✅ PASS | Every service method authorizes via `authz.authorize()`; workspace scoping auto-injected via `bindToContext`                         |
| API2  | Broken Authentication                           | ✅ PASS | Opaque session tokens; HMAC-SHA-256 lookup; rate limiting on auth endpoints; lockout after 5 failures                                |
| API3  | Broken Object Property Level Authorization      | ✅ PASS | Response shaping in API layer; PII redaction respects permissions; no over-returning via `select *` in sensitive paths               |
| API4  | Unrestricted Resource Consumption               | ✅ PASS | RateLimiterPort on all API endpoints; bulk operation size limits (Obj 12); pagination enforced                                       |
| API5  | Broken Function Level Authorization             | ✅ PASS | `platform/service-method-context-first` enforces ctx param; authz checked before any operation; linter catches missing checks        |
| API6  | Unrestricted Access to Sensitive Business Flows | ✅ PASS | Approval routing for deploy/rollback; rate limiting on sensitive flows (password reset, magic link)                                  |
| API7  | Server Side Request Forgery                     | ✅ PASS | External HTTP calls limited to explicitly configured IdP endpoints; no user-supplied URLs in outbound calls                          |
| API8  | Security Misconfiguration                       | ✅ PASS | Introspection disable-able; CORS configured; no debug endpoints in production builds                                                 |
| API9  | Improper Inventory Management                   | ✅ PASS | OpenAPI spec auto-generated from schema; versioned API; all endpoints documented                                                     |
| API10 | Unsafe Consumption of APIs                      | ✅ PASS | OIDC tokens validated (iss, aud, exp, nonce, sig); SAML assertions verified against IdP cert; `openid-client` handles JWT validation |

---

## Automated Scanning Results

### gitleaks (pre-commit + CI)

- High findings: 0
- Last scan: 2026-05-04 (clean)

### ESLint security plugin (CI)

- High findings: 0 (`security/detect-non-literal-regexp`, `security/detect-object-injection` — no violations on main)

### npm audit (CI)

- Critical/High findings: 0 (Renovate keeps deps current)

---

## Credential Leak Check

Architecture review confirms:

- No credentials appear in log output (Pino redacts `password`, `token`, `secret`, `key`, `authorization` fields by default; custom redact list in `deploy/observability/otel-collector.yaml`)
- gitleaks runs on every commit and PR
- `.env.example` contains no real secrets; `.env.local` is gitignored

---

## Findings Log

| ID   | Category | Severity | Description                           | Status | Remediation |
| ---- | -------- | -------- | ------------------------------------- | ------ | ----------- |
| None | —        | —        | No findings from this internal review | —      | —           |

---

## Deferred Items

| Item                              | Deferred To                             | Rationale                                                                                   |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- |
| WebAuthn/Passkeys                 | Follow-up objective after Obj 5         | Significant implementation; not blocking Stage 1                                            |
| At-rest encryption for DB volumes | Infrastructure (disk encryption)        | Platform relies on infra-level encryption; documented in threat model                       |
| External penetration test         | Before first paying customer (ADR-0091) | Internal review sufficient for Stage 1 development; external review required for production |
| File upload hardening (V12)       | File storage objective                  | Feature not yet implemented                                                                 |

---

## Overall Gate Result

**PASS** — Internal review complete. Zero critical, high, or medium findings. Platform is ready for Stage 1 development. External pentest required before first production customer per ADR-0091.
