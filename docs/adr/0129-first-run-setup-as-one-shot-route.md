# ADR-0129: First-Run Setup as a One-Shot Route

**Status:** Accepted
**Date:** 2026-05-05
**Deciders:** solo

## Context

When a new Lighthouse Studio installation starts up for the first time, there is no owner account and no workspace. The platform needs a way to bootstrap the installation without exposing an open registration path (which would let anyone claim the owner role).

Options considered:

1. CLI command run separately from the web app (e.g., `lighthouse-studio setup`)
2. An environment variable containing the initial owner credentials, read at startup
3. A one-shot web wizard served at `/setup` that disables itself after the first use

## Decision

Serve a **one-shot setup wizard at `/setup`** that:

1. On every request, checks whether setup is already complete (i.e., any user exists in the installation).
2. If complete, redirects immediately to `/auth/sign-in`.
3. If not complete, renders a form collecting: owner display name, email, password, first workspace name, and workspace slug.
4. On submission, creates the owner account with the `installation:owner` role, creates the first workspace with the owner as its sole member, signs the owner in, and sets the session cookie.
5. After a successful setup the route becomes permanently inaccessible (always redirects to sign-in).

The check-and-redirect is done server-side via `/api/v1/setup/status` (GET). The creation is done via `/api/v1/setup` (POST). Both routes return 409 if setup is already complete, preventing replay attacks.

The middleware excludes `/setup` and `/api/v1/setup*` from the session guard so the wizard is accessible before any session exists.

## Consequences

### Positive

- No CLI step required; operators point their browser at the instance and complete setup through the UI.
- Setup is effectively one-shot: after the first user is created the route is inert, so there is no ongoing attack surface.
- The wizard is self-guiding and validates all inputs client-side (Zod) before submission.
- No secrets or credentials need to appear in environment variables or deployment configuration.

### Negative

- If the setup POST succeeds but the client never receives the response (network interruption), the operator ends up with an owner account but no confirmation. They can sign in at `/auth/sign-in` and the setup route will redirect them there.
- The "any user exists" heuristic for completion can be fooled if an adapter bug allows a user to appear in the directory without a completed setup flow. A stricter approach (e.g., a `setup_complete` flag in a settings table) was considered but deferred as premature complexity for v1.

### Neutral

- The workspace slug chosen during setup can be changed later through workspace settings.
- The owner role is the only installation-wide super-role; workspace-level roles are managed separately.

## Alternatives Considered

### CLI Bootstrap

Run a command like `npx lighthouse-studio setup` before starting the web app.

**Why not chosen:** Adds operational friction. Operators running Docker or Kubernetes deployments would need a separate init container or manual step. The in-browser wizard is simpler and can be made part of the documented "first visit" flow.

### Environment Variable Seeding

Read `LIGHTHOUSE_OWNER_EMAIL` and `LIGHTHOUSE_OWNER_PASSWORD` from the environment at startup and create the owner account automatically.

**Why not chosen:** Credentials in environment variables are a secret-management concern. They also persist across restarts, creating a risk of accidental re-seeding if variables are left set. The interactive wizard is clearer about intent.

## References

- Objective 16 (Auth & User Management UI)
- `/app/setup/page.tsx`, `/api/v1/setup/route.ts`, `/api/v1/setup/status/route.ts`
