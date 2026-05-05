# ADR-0134: Localisation Scaffolding from Day One

**Status:** Accepted
**Date:** 2026-05-05
**Deciders:** solo

## Context

The platform's auth and account UI is the first surface end-users interact with. Deciding late to add internationalisation (i18n) to an existing UI is expensive: string extraction, translation key naming, and routing restructuring all become harder after strings are hardcoded.

The platform targets enterprise customers globally. While English is the initial language, French, German, Spanish, and Japanese are anticipated within the first year post-GA.

## Decision

**All user-visible strings in the auth, account, workspace admin, and installation admin UIs are keyed through `next-intl` from the first commit.**

Architecture:

- `next-intl` is the i18n library (chosen for first-class Next.js App Router support and server component compatibility).
- Message files live at `apps/web/messages/{locale}.json` (e.g., `en.json`, `fr.json`).
- The server-side config is at `apps/web/src/i18n/request.ts`; it exports `getRequestConfig` using `next-intl/server`.
- The Next.js config wraps the app with `createNextIntlPlugin` (via `next.config.mjs`).
- The root layout wraps the component tree with `NextIntlClientProvider`.
- Components retrieve strings via `useTranslations(namespace)` (client) or `getTranslations(namespace)` (server).
- All string keys are namespaced: `auth.*`, `account.*`, `workspace.*`, `admin.*`, `setup.*`, `common.*`.

**Locale detection order:**

1. User preference stored in their account (when signed in).
2. `Accept-Language` request header.
3. Fall back to `en`.

For v1, only `en` is shipped. The scaffolding is in place so that adding `fr.json` (and any locale-specific routing) requires no structural changes.

**No locale in URL paths for v1** (i.e., `/auth/sign-in`, not `/en/auth/sign-in`). Next.js i18n routing with path prefixes is deferred until a second locale is actively shipped; adding it later is a routing change but not a component change.

## Consequences

### Positive

- Zero hardcoded strings in UI components; all visible text is translatable.
- Adding a new locale requires only: a new `messages/{locale}.json` file (and translating it), plus registering the locale in the `next-intl` config.
- Server components can read translations without a client round-trip.
- Type safety: `useTranslations` is typed against the message schema; missing keys are caught at build time with the `next-intl` TypeScript plugin.

### Negative

- Every string requires a key lookup, adding minor verbosity to components compared to inline string literals.
- The `en.json` file must be kept in sync with component usage. Missing keys result in either a build error (with the TypeScript plugin) or a runtime fallback to the key name.
- Locale-aware date and number formatting (Intl API) must be applied consistently; components that format dates inline without `useFormatter()` will not be locale-aware.

### Neutral

- The `next-intl` version pinned in v1 supports Next.js 15 App Router with server components; upgrading Next.js may require a corresponding `next-intl` upgrade.
- Translation management (Crowdin, Lokalise, or equivalent) is not part of this ADR; the scaffolding is compatible with any workflow that produces `{locale}.json` files.

## Alternatives Considered

### React-i18next

Popular, framework-agnostic i18n library.

**Why not chosen:** Requires manual configuration for server components in the App Router. `next-intl` is purpose-built for Next.js and handles the server/client boundary transparently.

### Add i18n Later

Ship with hardcoded English strings and extract them when a second locale is needed.

**Why not chosen:** String extraction from an existing codebase is error-prone (missed strings, inconsistent key naming) and creates a significant PR affecting every UI file. The cost of adding i18n from day one is low (each component calls `useTranslations` instead of using a literal); the cost of retrofitting it later is high.

## References

- Objective 16 (Auth & User Management UI)
- `apps/web/messages/en.json`
- `apps/web/src/i18n/request.ts`
- `apps/web/next.config.mjs`
- `apps/web/src/app/layout.tsx`
- [next-intl documentation](https://next-intl-docs.vercel.app/)
