# Personal Data Registry

_Auto-generated from `packages/core/src/compliance/personal-data-registry.ts`. Do not edit manually._

_Last updated: 2026-05-02_

This registry enumerates every location in the platform's data model where personal data (PII) is stored. It drives GDPR data subject access exports, erasure handling, and privacy documentation.

---

## User Directory

| Location              | Category   | Purpose                                            | Legal Basis | Retention                        | Eraseable | Method    |
| --------------------- | ---------- | -------------------------------------------------- | ----------- | -------------------------------- | --------- | --------- |
| `users.primary_email` | contact    | authentication, communication, invitation delivery | contract    | until account deletion + 30 days | ✅        | anonymize |
| `users.display_name`  | identity   | user interface display                             | contract    | until account deletion + 30 days | ✅        | anonymize |
| `users.avatar_url`    | identity   | user interface display                             | contract    | until account deletion + 30 days | ✅        | delete    |
| `users.preferences`   | preference | personalising the platform experience              | contract    | until account deletion + 30 days | ✅        | delete    |

## Identity / Authentication

| Location                               | Category       | Purpose                                     | Legal Basis | Retention                        | Eraseable | Method |
| -------------------------------------- | -------------- | ------------------------------------------- | ----------- | -------------------------------- | --------- | ------ |
| `user_credentials.password_hash`       | authentication | password-based authentication               | contract    | until account deletion + 30 days | ✅        | delete |
| `user_credentials.mfa_totp_secret`     | authentication | TOTP multi-factor authentication            | contract    | until account deletion + 30 days | ✅        | delete |
| `user_credentials.recovery_codes`      | authentication | MFA recovery                                | contract    | until account deletion + 30 days | ✅        | delete |
| `sessions.user_id`                     | authentication | session tracking for authenticated requests | contract    | until session expiry             | ✅        | delete |
| `external_identities.provider_subject` | authentication | OAuth / OIDC / SAML identity linkage        | contract    | until account deletion + 30 days | ✅        | delete |

## Workspace Membership

| Location                      | Category | Purpose                                  | Legal Basis         | Retention                                                           | Eraseable | Method    |
| ----------------------------- | -------- | ---------------------------------------- | ------------------- | ------------------------------------------------------------------- | --------- | --------- |
| `workspace_members.user_id`   | identity | workspace access control and attribution | contract            | until workspace deletion or member removal + installation retention | ✅        | anonymize |
| `workspace_invitations.email` | contact  | invitation delivery and deduplication    | legitimate_interest | until invitation expiry or acceptance + 90 days                     | ✅        | delete    |

## Audit Log

| Location                         | Category | Purpose                                  | Legal Basis         | Retention              | Eraseable | Notes                                                                         |
| -------------------------------- | -------- | ---------------------------------------- | ------------------- | ---------------------- | --------- | ----------------------------------------------------------------------------- |
| `audit_log.actor_id`             | forensic | forensic record of actions performed     | legal_obligation    | 7 years (configurable) | ❌        | Retained for forensic integrity; user record anonymized on erasure            |
| `audit_log.actor_email_snapshot` | contact  | forensic record — email at time of event | legal_obligation    | 7 years (configurable) | ❌        | Not deleted; user directory anonymized, breaking correlation for non-auditors |
| `audit_log.ip_address`           | usage    | security forensics, abuse detection      | legitimate_interest | 7 years (configurable) | ❌        | Retained for security forensics                                               |

---

## Erasure Behaviour

When a user submits a GDPR Article 17 erasure request:

1. The user account is immediately **soft-deleted** (cannot sign in).
2. After the grace period (default 30 days):
   - Fields marked `eraseable: delete` are **physically deleted**.
   - Fields marked `eraseable: anonymize` are **replaced with deterministic pseudonyms** (e.g. `deleted-user-{hash}`).
   - Fields marked `eraseable: false` are **retained** with documented justification.
3. Audit events referencing the user's ID are **not modified** — forensic integrity is preserved.

## Notes on Non-Eraseable Fields

The audit log (`actor_id`, `actor_email_snapshot`, `ip_address`) is retained despite erasure requests because:

- Audit logs are a **legal obligation** and a tamper-evident forensic record.
- Modifying audit events would break the hash chain and destroy the compliance value of the log.
- After erasure, the `actor_id` still exists in audit events but the user directory entry is anonymized, so the audit log does not expose the original identity to readers without special access.

This balance is the platform's default. Installations in stricter jurisdictions can configure more aggressive anonymization via the compliance configuration.
