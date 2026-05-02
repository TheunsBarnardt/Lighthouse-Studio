# ADR-0035: Email Enumeration Prevention

**Status:** Accepted
**Date:** 2026-05-02
**Deciders:** solo

## Context

Many authentication endpoints leak whether a given email address exists in the system through their responses. An attacker who discovers which emails are registered can:

- Target phishing attacks more precisely.
- Correlate user identities across services.
- Infer organisational structure from corporate email patterns.

The three high-risk endpoints are: sign-in, password reset, and magic link request.

## Decision

**Uniform responses on all three endpoints regardless of whether the email exists.**

| Endpoint               | Response if email exists         | Response if email does not exist |
| ---------------------- | -------------------------------- | -------------------------------- |
| Password sign-in       | `INVALID_CREDENTIALS` (if wrong) | `INVALID_CREDENTIALS` (same)     |
| Magic link request     | 200 OK, email sent               | 200 OK, no email sent (silent)   |
| Password reset request | 200 OK, email sent               | 200 OK, no email sent (silent)   |

For password sign-in, the timing must also be constant to prevent timing attacks. The `BuiltinIdentityProvider` does not short-circuit when the user is not found — it performs a constant-time comparison (argon2id verify with a dummy hash) before returning the same error code.

For magic link and password reset, the response is a uniform 200 regardless of whether the email is found. If the email does not exist, no email is sent and the call returns silently.

## Consequences

### Positive

- Attackers cannot determine which emails are registered from response inspection.
- Consistent with OWASP Authentication Cheat Sheet recommendations.

### Negative

- Users who mistype their email for a password reset receive no indication that the email was not found. They will wait for an email that never arrives. This is a real UX degradation.
- The silent success for magic link means users who have not yet signed up won't receive an email and won't understand why.
- Timing attacks against the password endpoint require genuine constant-time implementation — any short-circuit path (e.g., returning early when the user does not exist) leaks timing information. This must be enforced in code review.

### Neutral

- For magic link, the silent success is the correct UX pattern when paired with a message like "If an account exists with that email, you'll receive a link shortly." The platform's UI should use this phrasing.

## Alternatives Considered

### Distinct responses (user not found vs. wrong password)

More helpful UX. Rejected because it enables email enumeration. The UX cost is acceptable given the security benefit for an administrative platform.

### Rate limiting as the only defence

Rate limit sign-in attempts to prevent enumeration via timing. Rate limiting is a necessary complement, not a substitute. A slow brute-force scan of 10 emails/minute is often below rate-limit thresholds. Uniform responses prevent this regardless of scan rate.

### Requiring email verification before any sign-in (no account, no error)

If accounts require verification before they "exist," enumeration becomes harder but not impossible (verification email timing leaks existence). Not a substitute for uniform responses.

## References

- `packages/adapters/identity-builtin/src/identity-provider.adapter.ts` — `beginPasswordSignIn`
- `packages/adapters/identity-builtin/src/flows/magic-link.ts` — `send`
- `packages/adapters/identity-builtin/src/flows/password-reset.ts` — `request`
- OWASP Authentication Cheat Sheet
