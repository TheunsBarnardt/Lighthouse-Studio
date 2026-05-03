# Threat Model

_Last updated: 2026-05-02. Update whenever architectural changes affect threat surfaces._

This document identifies the platform's threat surfaces, threat actors, and mitigations. It is maintained alongside the codebase and reviewed when the architecture changes.

---

## Scope

This threat model covers the self-hosted Lighthouse Studio platform. The cloud-hosted variant has additional considerations (multi-tenancy at the infrastructure level) covered separately.

---

## System Description

Lighthouse Studio is a self-hosted platform consisting of:

- **Web app:** React SPA served via Caddy
- **API server:** Fastify HTTP API
- **Worker:** Background job processor
- **Database:** PostgreSQL, MSSQL, or MongoDB (customer's choice)
- **External:** Storage (Backblaze B2 / Azure Blob), email, identity providers

---

## Threat Actors

| Actor               | Motivation                         | Capability                                      |
| ------------------- | ---------------------------------- | ----------------------------------------------- |
| External attacker   | Data theft, ransomware, disruption | Network access, credential stuffing, known CVEs |
| Malicious insider   | Data exfiltration, sabotage        | Authenticated access, potential database access |
| Compromised account | Same as their level of access      | Stolen credentials, session hijacking           |
| Database admin      | Full data access, audit tampering  | Direct database access (bypasses application)   |
| Automated bots      | Credential stuffing, scraping      | Automated tooling                               |

---

## STRIDE Analysis

### Spoofing

| Threat                     | Mitigation                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Credential theft / reuse   | Argon2id password hashing (ADR-0030); MFA enforcement; session revocation on password change |
| Session hijacking          | Database-backed sessions (ADR-0031); short TTLs; secure/httpOnly cookies                     |
| Identity provider spoofing | OIDC/SAML signature verification; JIT provisioning with explicit trust configuration         |

### Tampering

| Threat                                   | Mitigation                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Database record modification             | Optimistic locking (ADR-0010); audit log with hash chain (Objective 7)                    |
| Audit log tampering                      | Append-only DB permissions (`app_user` has INSERT only); hash chain detects modifications |
| Migration tampering                      | SHA-256 checksum verification on applied migrations (ADR-0028)                            |
| Code injection in AI-generated functions | Static analysis + sandboxing (Objective 27)                                               |

### Repudiation

| Threat                           | Mitigation                                                                               |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| User denies performing an action | Immutable audit log with hash chain; all state changes attributed to authenticated actor |
| System denies processing         | Correlation IDs; structured logging; audit of system actions                             |

### Information Disclosure

| Threat                          | Mitigation                                                      |
| ------------------------------- | --------------------------------------------------------------- |
| Cross-workspace data leakage    | Workspace-scoped queries auto-injected (ADR-0055); RLS policies |
| PII in logs                     | PII-tagged fields in audit metadata; log sanitization           |
| Email enumeration               | Timing-safe email lookup (ADR-0035)                             |
| Token leakage                   | HMAC-hashed invitation tokens; no tokens in audit metadata      |
| Sensitive data in audit exports | PII redaction on non-auditor exports                            |

### Denial of Service

| Threat                         | Mitigation                                             |
| ------------------------------ | ------------------------------------------------------ |
| Audit log write flooding       | Per-request batching; backpressure handling in adapter |
| Database connection exhaustion | PgBouncer connection pooling (ADR-0025)                |
| AI cost flooding               | Per-workspace token budgets (Objective 20)             |

### Elevation of Privilege

| Threat                                 | Mitigation                                                                          |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Workspace privilege escalation         | Default-deny RBAC (ADR-0052); no implicit grants                                    |
| Installation role abuse                | `installation_owner` required for destructive operations; audit of all role changes |
| SQL injection                          | Parameterized queries throughout; Drizzle ORM for Postgres                          |
| Command injection in AI-generated code | Sandbox with network allowlist and memory cap (Objective 27)                        |

---

## Data Flows

### Client → API

- **Trust boundary:** TLS terminated at Caddy
- **Authentication:** Session cookie (httpOnly, Secure) or service account API key
- **Threat:** Session hijacking → Mitigated by short TTLs, revocation

### API → Database

- **Trust boundary:** Internal network (customer infrastructure)
- **Authentication:** Database user credentials (distinct app_user and migrate_user)
- **Threat:** SQL injection → Parameterized queries; Drizzle ORM

### API → External Identity Provider

- **Trust boundary:** TLS to provider
- **Authentication:** Provider-specific (OAuth2 PKCE, SAML assertions)
- **Threat:** Provider compromise → Scoped provider trust; JIT provisioning

### Worker → Database

- **Trust boundary:** Internal network
- **Authentication:** audit_retention_user (DELETE-only on audit_log)
- **Threat:** Unauthorized deletion → Role-separated database users

### API → Storage (B2 / Azure)

- **Trust boundary:** TLS to storage API
- **Authentication:** Storage credentials via SecretStorePort
- **Threat:** Credential exposure → Secrets never in source; rotated via secret store

---

## High-Value Assets

| Asset                              | Risk if Compromised             | Mitigations                                              |
| ---------------------------------- | ------------------------------- | -------------------------------------------------------- |
| User credentials (password hashes) | Account takeover                | Argon2id; MFA                                            |
| Session tokens                     | Account takeover                | Short TTLs; httpOnly cookies; database-backed revocation |
| Audit log                          | Loss of forensic record         | Append-only permissions; hash chain; cold archive option |
| Database (all data)                | Full data breach                | Application-layer RBAC; network isolation (customer)     |
| AI-generated code                  | Code execution in customer apps | Sandboxing; static analysis; human review gate           |

---

## Known Limitations / Accepted Risks

1. **Hash chain is tamper-evident, not tamper-proof.** A database admin with full credentials can rewrite events and recompute hashes. Mitigation: cold archive with object lock (optional) provides tamper-proof evidence.

2. **Database admin is a privileged attacker.** The platform cannot fully defend against a compromised database administrator. Customers must apply appropriate controls at the infrastructure level (access controls, audit of database-level operations via database's native audit).

3. **At-rest encryption is infrastructure-level.** The platform does not encrypt data at rest in the application layer. Customers must enable database-level or disk-level encryption on their infrastructure.

4. **SSRF in AI tool execution.** AI-generated server functions can potentially make network requests. Mitigated by the network allowlist in the sandbox (Objective 27), but not fully eliminated until the allowlist is validated against customer requirements.

---

## Review Schedule

This threat model is reviewed:

- Annually (scheduled)
- After any architecture change that introduces a new component, data flow, or trust boundary
- After a security incident that reveals a gap in this analysis

_Next scheduled review: 2027-05-02_
