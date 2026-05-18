# ADR-0282: File-Backed User Directory (Dev Persistence Parity)

**Status:** Accepted
**Date:** 2026-05-18

## Context

In the Next.js dev server, workspaces and workspace-members were persisted to disk via `createFileRepo` at `.lighthouse-data/*.json`, but the user directory was in-memory only (`InMemoryUserDirectory`).

This asymmetry produced a confusing recurring bug:

1. User signs up → in-memory user `U1` created, workspace `W1` written to disk with `ownerUserId = U1`.
2. Dev server restarts (config change, full `pnpm dev` cycle, OS reboot, etc.).
3. In-memory user is gone; persisted workspace `W1` remains.
4. User tries to sign in → `findByEmail` returns null (no users persisted) → INVALID_CREDENTIALS.
5. User signs up "again" with the same email → succeeds because in-memory directory is empty → new user `U2` with a new id.
6. `GET /api/v1/workspaces` filters by `userId = U2`, finds zero memberships → auto-provisions another fresh workspace `W2`.
7. The original workspace `W1` is now orphaned forever (its owner `U1` no longer exists in any system).

Symptom the user reported: "I created a workspace, logged out, logged back in, and don't see it anymore." The actual trigger isn't logout — it's any server restart between two sign-ins.

## Decision

Make the user directory file-backed with the same `.lighthouse-data/*.json` pattern as workspaces, and recover the existing orphans automatically on first sign-in after the change.

**Two pieces:**

1. **`FileBackedUserDirectory`** (`apps/web/src/lib/server/file-user-directory.ts`) — implements `UserDirectoryPort` and persists both `users` and `user-credentials` (password hashes, MFA secrets, recovery codes, lockout state) to `.lighthouse-data/users.json` and `.lighthouse-data/user-credentials.json`. Flushes on every mutation. Replaces `InMemoryUserDirectory` in the web app's server composition.

2. **Orphan adoption in `GET /api/v1/workspaces`** — when the signed-in user has zero memberships, before auto-provisioning a brand-new workspace, the endpoint checks for workspaces whose `ownerUserId` is not in the persisted user directory. Those are orphans from the pre-fix world and get adopted by the current user: workspace `ownerUserId` rewritten, matching membership rows rewritten with the new userId, missing membership rows created. The response includes an `adopted` count for visibility.

Sessions remain in-memory (`InMemorySessionAdapter`) — losing your login on server restart is normal and expected dev UX. The fix is for data persistence, not session continuity.

## Consequences

**What this enables:**

- Workspaces created today still exist tomorrow under the same email + password, no matter how many times the dev server restarts.
- The existing `.lighthouse-data/workspaces.json` data isn't lost — it gets adopted by the next user who signs in.
- The pattern is now consistent: anything written to `.lighthouse-data/` outlives the process, and the user directory is part of that contract.

**What this complicates:**

- Password hashes now sit on disk in plaintext JSON. This is **dev-only** persistence; production composition will use a real database. The risk surface is local-machine-only. `.lighthouse-data/` should remain `.gitignore`d (verify before committing).
- Orphan adoption is permissive: the _first_ user to sign in after restart claims _all_ pre-restart workspaces, since "orphan" means "owner not in the directory" and on first sign-in the directory has exactly one user. This is correct in single-user dev but wrong in any multi-user scenario. Acceptable for dev; the production composition won't have this adoption logic.

**What becomes harder:**

- Tests that previously assumed an empty user directory at startup may now find residual users if `.lighthouse-data/users.json` exists. Test harnesses should clear `.lighthouse-data/` or use a separate `DATA_DIR`. (No test changes needed in this PR — tests use the in-memory composition directly.)

## Alternatives considered

1. **Wipe `.lighthouse-data/` whenever users are wiped.** Rejected — destroys real user data (workspaces, branding, etc.) every restart and amplifies the problem rather than fixing it.
2. **Persist sessions instead, so logout/login round-trips a stable userId.** Rejected — doesn't address the underlying asymmetry. After a fresh restart with no sessions, the next sign-in still mints a new user.
3. **Detect duplicate-email sign-ups and merge into the existing user.** Rejected — only works if some user record persists; with a fully in-memory directory there's no existing user to merge into.
4. **Keep the bug, document it.** Rejected — recurring data loss is unacceptable even in dev. The user lost their "Otto1890" workspace once already.
5. **Use the file-repo abstraction (`createFileRepo`) for users.** Considered. Rejected for users because the User entity has more nuance than the generic `id+version` shape (identities array, credentials separate from profile). Writing a purpose-built adapter is clearer than fighting the generic. Credentials in particular shouldn't be queryable as a "user" entity — they're a side-table.

## References

- `apps/web/src/lib/server/file-user-directory.ts` — the new adapter
- `apps/web/src/lib/server/auth-service.ts` — composition wired to use it
- `apps/web/src/app/api/v1/workspaces/route.ts` — orphan adoption in `GET`
- `apps/web/src/lib/server/file-repo.ts` — the existing pattern this mirrors
- `.lighthouse-data/users.json`, `.lighthouse-data/user-credentials.json` — created on first sign-up after this change
