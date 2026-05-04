# ADR-0102: API Key Storage as HMAC-SHA-256, Not Encrypted

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The auto-generated REST API supports two authentication paths: session tokens (for interactive users) and API keys (for server-to-server access). API keys are long-lived bearer tokens that must:

- Be verifiable on every request (< 5ms overhead target)
- Never be recoverable in plaintext after creation (if the database is exfiltrated, keys are not exposed)
- Be revocable without rotating the storage key
- Support lookup by a short prefix (for database index efficiency)

## Decision

Store API keys as **HMAC-SHA-256** of the raw key, using a per-installation secret loaded from the secret store.

Key format: `pkey_<8-char-prefix>_<56-char-random>`

- `pkey_` prefix identifies the token type
- `<8-char-prefix>` is stored in the `key_prefix` column, indexed for lookup
- The full key is HMAC'd with the installation secret; the result (`key_hash`, 64 hex chars) is stored with a UNIQUE constraint

**Verification flow:**

1. Extract the `key_prefix` from the presented key (parse `pkey_<prefix>_...`)
2. Compute `HMAC-SHA-256(rawKey, installationSecret)` → `candidateHash`
3. Look up by `key_hash = candidateHash` (O(1) indexed lookup; hash is globally unique)
4. Check revocation and expiry
5. Return `ApiKeyPrincipal` on success

**Creation:** Return the plaintext key exactly once (in the `create` response). It is never stored; subsequent requests only show the key prefix.

## Consequences

**What becomes easier:**

- Verification is a single HMAC computation + indexed lookup — no decryption, no constant-time comparison complexity beyond what HMAC provides.
- Key revocation is instant: set `revoked_at`. No need to rotate encryption keys.
- An exfiltrated database without the HMAC secret reveals nothing useful about the raw keys.

**What becomes harder:**

- If the installation HMAC secret is compromised alongside the database, all keys are at risk. The secret must be stored in the secret store (Objective 3), not in config files.
- Rotating the HMAC secret requires re-hashing all existing keys (a maintenance operation) or accepting that old-hash keys stop working (requiring re-issuance).

## Alternatives Considered

**Symmetric encryption (AES-256-GCM):** More complex to implement correctly (nonce management, authenticated encryption). Provides decryption capability which is not needed — we never need to recover the plaintext after creation. HMAC is sufficient and simpler.

**Bcrypt / Argon2 (password hashing):** Designed for human-chosen passwords; deliberately slow (10-100ms). API keys are long random strings, not passwords. Using bcrypt would add 50-100ms to every API request. Unacceptable for a production API.

**Store plaintext in a vault:** Requires a network call to the vault on every request (50-200ms latency). Defeats the purpose of a local database lookup. Usable as a fallback, not as the primary path.

**No secret (store hash of raw key only):** Without an HMAC secret, hash lookup is safe but an attacker with the database can brute-force short keys. The HMAC secret makes brute-force infeasible even with the database.

HMAC-SHA-256 with a secret is the industry-standard approach for API keys (used by Stripe, GitHub, and others). It balances security, performance, and operational simplicity.
