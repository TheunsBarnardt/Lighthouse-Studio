# ADR-0036: Password Policy Choice

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Password policies are a major source of friction and, paradoxically, often reduce security. Common policies (uppercase + lowercase + number + symbol, frequent rotation, no reuse) have been shown to produce predictable patterns (P@ssw0rd1!) rather than genuinely strong passwords.

NIST SP 800-63B (2017, revised 2024) reversed earlier recommendations: complexity rules, composition requirements, and mandatory rotation are no longer recommended. The focus shifted to **length** and **breach corpus checking**.

## Decision

**Minimum length: 12 characters. No complexity requirements. HIBP breach corpus check default-enabled.**

Specifically:

- **Minimum length**: 12 characters. No maximum (argon2id handles long passwords; bcrypt's 72-byte cap is why we don't use bcrypt).
- **No composition rules**: no requirements for uppercase, lowercase, numbers, or symbols. These are counterproductive (see NIST).
- **No rotation**: passwords do not expire. Users who suspect compromise reset via the password reset flow.
- **HIBP check**: On signup and password change, the platform checks the password against the Have I Been Pwned k-anonymity API (SHA-1 prefix lookup; the full plaintext is never sent). If the password appears in a known breach corpus, the user is prompted to choose a different password. The check fails open (network error → check skipped, password accepted).
- **Configurable**: `hibpCheck` can be disabled per deployment (`BuiltinProviderConfig.hibpCheck: false`) for air-gapped installations that cannot reach `api.pwnedpasswords.com`.

**Account lockout** (separate from the policy): 5 consecutive failed password attempts locks the account for 15 minutes. This is distinct from the password policy; it limits online brute-force regardless of password strength.

## Consequences

### Positive

- Encourages long passphrases over short complex passwords. "correct horse battery staple" is stronger and more memorable than "P@ssw0rd1!".
- HIBP check rejects the most common passwords (the top 1 million+ breached passwords are in the corpus) without false positives for strong passwords.
- No false urgency from rotation requirements; users don't respond to forced rotation by incrementing a suffix.
- NIST-compliant for deployments that require it.

### Negative

- Users accustomed to complexity meters may find the policy confusing ("why doesn't it require a symbol?"). The UI should explain the policy.
- HIBP API availability (external service, though k-anonymity means only a 5-character SHA-1 prefix is sent). Mitigated by fail-open.
- 12-character minimum may still admit weak passwords ("111111111111"). HIBP check catches these if they are in breach corpora, but novel weak patterns are not caught.

### Neutral

- The 12-character minimum is stricter than NIST's 8-character recommendation, which the platform adopts as a reasonable baseline for an administrative platform.

## Alternatives Considered

### Complexity rules (uppercase + lowercase + number + symbol)

The traditional approach. Rejected: NIST SP 800-63B §5.1.1 explicitly recommends against these because they produce predictable patterns and encourage weak-but-conforming passwords.

### Mandatory rotation (90-day expiry)

Previously common in enterprise policy. Rejected: NIST SP 800-63B §5.1.1 recommends against scheduled rotation. Rotation should be triggered by suspected compromise, not by calendar.

### zxcvbn strength estimation

Client-side strength estimation (Dropbox's zxcvbn). Potentially useful as a UI indicator but not as a server-side gate (client can bypass). HIBP at the server covers the most dangerous cases. May be added to the UI layer in a future iteration.

## References

- `packages/adapters/identity-builtin/src/hibp.ts`
- `packages/adapters/identity-builtin/src/password.ts`
- NIST SP 800-63B §5.1.1
- Have I Been Pwned API: `api.pwnedpasswords.com/range/{5-char prefix}`
