# ADR-0076: The Canonical Service Method Shape

**Status:** Accepted
**Date:** 2026-05-02
**Objective:** 08-service-layer-architecture

---

## Context

As the platform grew through Objectives 3–7, each service was authored
independently. The patterns were similar — authorize, read, write, audit — but
the ordering and error handling varied between authors and between sessions.
By Objective 7, `WorkspaceService`, `MemberService`, and `InvitationService`
had slight ordering differences (some authorised before validating, some after).
These differences are harmless individually but compound into a maintenance
hazard and a security review red flag.

We need a single, mandatory, documented shape that every service method follows.

---

## Decision

Every public service method follows this ordered pipeline with no exceptions:

```
validate → authorize → precondition → execute → audit → return
```

1. **Validate** — zod `safeParse` on all input; return `ValidationError` on failure.
2. **Authorize** — `authz.authorize(ctx, action, resource)`; return `ForbiddenError` on denial.
3. **Precondition** — database-level business rule checks (uniqueness, parent exists, etc.).
4. **Execute** — call repositories and external ports.
5. **Audit** — `audit.write()` for every state-changing method; inside any surrounding transaction.
6. **Return** — `ok(result)`.

The method signature is always `async fn(ctx: Context, input: Input): Promise<Result<Output, AppError>>`.

---

## Consequences

**What becomes easier:**

- Code review has a single checklist; skipped steps are immediately visible.
- Security audits can confirm that every method authorises before acting.
- Junior contributors follow the template; no architectural decisions required.
- ESLint rules (`platform/audit-on-mutation`, `platform/service-method-context-first`) catch deviations mechanically.

**What becomes harder:**

- Methods with unusual shapes (e.g., a method that reads but not writes, or one that skips authorization intentionally for system operations) require explicit documentation of why they deviate. Deviation requires a comment; the linter warns on audit-on-mutation but only at warning level for this reason.

**Alternatives considered:**

- _No standard shape_ — rejected; already producing inconsistency after 7 objectives.
- _Only authorize + execute_ — rejected; the full shape is needed for validation (defense in depth) and audit (compliance).
