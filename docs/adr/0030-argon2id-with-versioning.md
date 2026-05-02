# ADR-0030: argon2id with Versioning

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Password hashing is the primary defence when a credential database is exfiltrated. The hashing algorithm must be:

- **Memory-hard** — to defeat GPU and ASIC attacks.
- **Configurable** — parameters should increase as hardware improves.
- **Migratable** — stored hashes should carry enough metadata to verify after parameter changes.

The common options in 2026 are bcrypt, scrypt, Argon2i, Argon2d, and Argon2id.

## Decision

Use **argon2id** via `@node-rs/argon2` (Rust binding; much faster than pure-JS alternatives) with the following parameters:

| Parameter   | Value  | Rationale                                           |
| ----------- | ------ | --------------------------------------------------- |
| Memory cost | 64 MiB | OWASP recommendation for interactive logins         |
| Time cost   | 3      | ~300ms on commodity server hardware                 |
| Parallelism | 4      | Saturates 4 cores; limits single-threaded attackers |

Every stored hash carries a `version: number` field (currently `1`). The `BuiltinIdentityProvider` re-hashes on successful login when `version < CURRENT_VERSION`. This enables transparent parameter upgrades: bump `CURRENT_VERSION`, and hashes migrate on next login without forcing a password reset.

Argon2id is preferred over Argon2i (timing side-channel risk) and Argon2d (side-channel risk via data-dependent memory access). Bcrypt is capped at 72-byte passwords and has no memory hardness parameter. scrypt lacks the side-channel resistance of Argon2id.

Recovery codes use lighter argon2id parameters (16 MiB memory, 2 iterations) because they are long random strings and the attack surface is different from passwords.

## Consequences

### Positive

- argon2id is the Argon2 variant recommended by OWASP and NIST SP 800-63B.
- The `@node-rs/argon2` Rust binding avoids the ~3× overhead of pure-JS wasm implementations.
- Version tagging enables zero-downtime parameter migration.

### Negative

- 64 MiB memory reservation per hash means concurrent sign-ins must be rate-limited to avoid exhausting server RAM. With parallelism=4, a burst of 100 concurrent logins requires 6.4 GiB just for argon2 — the platform's auth service must enforce concurrency limits.
- `@node-rs/argon2` is a native addon; cross-compilation for arm64 and Windows requires build toolchains.

### Neutral

- The `VersionedHash` type (`{ hash, version, algorithm }`) makes the migration strategy explicit in the type system rather than embedded in string prefixes.

## Alternatives Considered

### bcrypt

Widely deployed, well-understood. Rejected because it is capped at 72 bytes (passwords can be silently truncated), has no memory hardness parameter, and bcrypt's work factor increase is linear while hardware improvements are exponential.

### scrypt

Memory-hard but lacks argon2id's resistance to side-channel attacks via data-dependent memory access. Less actively maintained standard. Rejected.

### PBKDF2

Required by FIPS; not memory-hard. Suitable for key derivation in regulated environments, not for password hashing where an attacker has GPU arrays. Rejected.

## References

- `packages/adapters/identity-builtin/src/password.ts`
- OWASP Password Storage Cheat Sheet
- NIST SP 800-63B §5.1.1.2
