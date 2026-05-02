# ADR-0032: TOTP and Recovery Codes for MFA

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Multi-factor authentication (MFA) significantly reduces account takeover risk. The platform needs to offer MFA for administrative accounts. Several options exist: TOTP (authenticator apps), WebAuthn (hardware keys, passkeys), SMS OTP, and email OTP.

A second factor's value depends on it being independent from the first factor. SMS is attackable via SIM swapping. Email OTP is weakened if the attacker already has email access (which is the most common first-factor compromise vector).

## Decision

**v1 MFA: TOTP (RFC 6238) + 10 × 8-digit recovery codes.**

TOTP is implemented via the `otpauth` library with:

- Algorithm: SHA1 (RFC 6238 standard; SHA-256 TOTP is not yet universally supported by authenticator apps)
- Period: 30 seconds
- Digits: 6
- Clock skew tolerance: ±1 window (30 seconds)

**Recovery codes:**

- 10 codes, 8 numeric digits each, generated from `crypto.randomBytes`.
- Stored as argon2id hashes in the user directory.
- Each code is single-use (`consumeRecoveryCode` removes the used hash atomically).
- Shown to the user only at enrollment; cannot be recovered afterwards (user must regenerate).

**Secret storage:**

TOTP secrets are encrypted with AES-256-GCM before storage. The encryption key is held in `SecretStorePort` under a named key (`mfa-totp-encryption-key`). This separates the encryption key from the credential store — an attacker who exfiltrates the session/credential database cannot decrypt TOTP secrets without also compromising the secret store.

**WebAuthn deferred** (v2): passkeys are the preferred long-term MFA. Deferred because:

- WebAuthn requires a different enrollment UX (physical device or platform biometric).
- The `otpauth`-based TOTP is sufficient for v1 administrative users.
- The `MfaPort` is designed to accommodate WebAuthn as a second method (`verifyRecoveryCode` stays TOTP-specific; a WebAuthn adapter would add `beginWebauthnRegistration`, etc.).

## Consequences

### Positive

- TOTP works offline and is supported by every major authenticator app (Google Authenticator, Authy, 1Password, Bitwarden).
- Recovery codes provide a fallback that doesn't require a separate device or account.
- Argon2id-hashed recovery codes are safe at rest even if the credential table is leaked.

### Negative

- TOTP is vulnerable to real-time phishing (attacker proxies the code in the 30-second window). WebAuthn (passkeys) solves this — deferred to v2.
- SHA1 is used for TOTP compatibility; while SHA1 is deprecated for signing, it is not broken for HMAC-based OTP.
- Recovery codes must be printed and stored securely. Users who lose both their device and their recovery codes are permanently locked out.

### Neutral

- The `BuiltinMfaAdapter.pending` map holds in-progress TOTP enrollment state in memory. For multi-instance deployments, pending enrollment windows are lost on restart (max 10-minute window). Acceptable for v1; can be moved to a distributed store later.

## Alternatives Considered

### WebAuthn / Passkeys (first choice)

Phishing-resistant, no shared secret, no clock dependency. Deferred because the enrollment UX requires browser API support and a hardware or platform authenticator. v1 targets administrative users who may not have hardware keys.

### SMS OTP

No app required. Rejected due to SIM-swapping attacks and carrier dependencies. Not appropriate for a security-focused platform.

### Email OTP

Simple to implement. Rejected because compromised email = compromised second factor. The platform already uses email for magic links; mixing email-as-second-factor creates confusion.

## References

- `packages/ports/identity/src/mfa.port.ts`
- `packages/adapters/identity-builtin/src/mfa.adapter.ts`
- `packages/adapters/identity-builtin/src/crypto.ts`
