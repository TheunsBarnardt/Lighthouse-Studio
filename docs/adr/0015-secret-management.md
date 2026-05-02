# ADR-0015: Secret Management

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

The platform handles secrets including database passwords, auth secrets, S3 keys, SMTP credentials, and API keys. These must be:

- Never committed to git
- Available to containerised services at runtime
- Isolated per environment (dev secrets cannot decrypt staging sessions)
- Recoverable in a disaster scenario
- Auditable (we know who changed a secret and when)

There are many options ranging from a local `.env.local` file to full secrets managers (Vault, AWS Secrets Manager, Azure Key Vault).

## Decision

Layered secret management without a third-party secrets manager for the initial phase:

1. **Local development:** `.env.local` at repo root (gitignored). Developer generates secrets locally using `openssl rand -base64 48` etc.
2. **Server environments (dev/staging/prod):** Coolify environment variables, marked as "sensitive" (write-only after creation in Coolify UI). Each environment's secrets live in that environment's Coolify resource config.
3. **Pre-commit and CI:** `gitleaks` scans staged changes and diffs to prevent secrets from entering git history.
4. **Validation:** All secrets pass through the Zod schema in `packages/config`. Missing or malformed secrets cause a startup failure with a clear error message.

Backup/recovery of secrets:

- Coolify exports can be backed up encrypted (Restic)
- Maintainer's password manager stores master secrets (DB passwords, `AUTH_SECRET` per env)
- Offline copy of the Restic encryption passphrase in a physically secure location

Environment isolation is enforced by different `AUTH_SECRET` values per environment (different secrets, different signed sessions — a leak in dev cannot decrypt prod sessions).

## Consequences

### Positive

- No external dependency: no Vault cluster to operate
- Coolify's "sensitive" flag prevents accidental exposure in logs/UI
- Gitleaks catches the most common mistake (committing secrets) at the earliest possible point
- The Zod validation makes "what secrets are required" explicit and self-documenting
- Works identically on Linux and Windows (environment variables are universal)

### Negative

- Coolify is now in the trust boundary: Coolify must be operated securely (IP-restricted admin)
- No automatic secret rotation — rotation is a manual process documented in the runbook
- If Coolify's storage is compromised, all server-side secrets are compromised
- No centralised audit log of "who changed secret X at time T" (Coolify's UI has some logging but it's not a compliance-grade audit trail)

### Neutral

- A third-party secrets manager (Vault, cloud KMS) can be added later without changing application code — the validation layer can remain the same while the source of secrets changes
- `SecretStorePort` (Objective 1.5) provides the abstraction for programmatic secret access; this ADR covers the human-facing secret distribution, not in-app secret access

## Alternatives Considered

### Option A: HashiCorp Vault (self-hosted)

Pros: Excellent audit logs; dynamic secrets; automatic rotation; encryption-as-a-service.
Cons: Another service to operate; complex HA setup; significant operational overhead for a solo maintainer. Vault is excellent at scale; it's over-engineered for a single-server deployment.

### Option B: AWS Secrets Manager / Azure Key Vault

Pros: Managed; audit logs; IAM integration.
Cons: Creates a cloud provider dependency. Inconsistent with the self-hosted positioning. Per-secret charges add up.

### Option C: SOPS (Secrets OPerationS) + git-encrypted secrets

Pros: Secrets are in git (encrypted); version history for free.
Cons: Encrypted secrets in git are still a target. Key management (GPG keys, age keys) is non-trivial. Accidental key loss can make secrets unrecoverable.

## References

- Objective 2: Environment Strategy (Section 5.8)
- `docs/runbooks/secret-rotation.md`
- ADR-0002: Environment Strategy
