# ADR-0031: Database-Backed Sessions over JWT

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Web session management has two mainstream models:

1. **Stateless JWT** — the token is self-contained (claims, expiry, signature). The server verifies the signature without any database lookup. Revocation requires a denylist, which reintroduces state.
2. **Opaque token with server-side store** — the token is a random value; the server looks up session data on each request. Revocation is instant (delete the row).

The platform's primary use case is an administrative console accessed by a small number of operators (not a high-traffic public API). Security properties are more important than stateless scalability.

## Decision

Use **opaque session tokens backed by `SessionPort`** (Postgres for production, in-memory for tests).

**Token handling:**

- The raw token is a 32-byte cryptographically random value encoded as base64url.
- Only the HMAC-SHA256 of the token is stored (`token_hash`). If the session table is leaked, tokens cannot be replayed.
- `findByToken` hashes the incoming token and does an indexed lookup on `token_hash`.
- `refresh` is an atomic `UPDATE ... SET token_hash = $new WHERE token_hash = $old`, invalidating the old token in the same round trip.

**Token lifetime:**

- Default TTL: 7 days.
- `touch` updates `last_seen_at` on every verified request (sliding expiry tracking for auditing).
- `cleanupExpired` deletes expired rows; runs nightly in production.

**Session metadata:**

Sessions record `identity_provider`, `workspace_id`, `ip_address`, `user_agent`, and arbitrary `metadata`. This enables admin UIs to show active sessions and security teams to investigate suspicious activity.

## Consequences

### Positive

- Instant revocation: `revoke(sessionId)` or `revokeAllForUser(userId)` takes effect on the next request.
- Session table doubles as an audit log of active (and recently expired) sessions.
- No JWT secret rotation problem: revoked tokens are simply deleted.
- No token-bloat in request headers or cookies (opaque token is small).

### Negative

- Every authenticated request requires a database lookup. The Postgres adapter mitigates this with an indexed `token_hash` column; the lookup is O(log n).
- Horizontal scaling requires all instances to reach the same session store. Fine for the platform's architecture (shared Postgres); would require Redis or similar for true stateless scaling.
- `cleanupExpired` is a background maintenance task. If missed, expired rows accumulate.

### Neutral

- The session store could be swapped to Redis (faster lookups) by implementing `SessionPort` against Redis. The port and all consuming code remain unchanged.

## Alternatives Considered

### JWT (HS256 or RS256)

Stateless, no DB lookup per request. Rejected because:

- Revocation requires a denylist (reintroducing state) or accepting that stolen tokens are valid until expiry.
- JWT claims can grow large (roles, permissions, workspace IDs) and are sent in every request header.
- The platform's admin console does not have the throughput requirements that justify stateless token verification.

### Cookie-based session (server-side store, cookie value is opaque ID)

Equivalent to the chosen design. The platform uses the same model but expressed as a port to remain transport-agnostic (the session ID is passed in headers for API clients, in cookies for browser clients).

## References

- `packages/ports/identity/src/session.port.ts`
- `packages/adapters/identity-postgres/src/session.adapter.ts`
- `packages/adapters/identity-memory/src/session.adapter.ts`
