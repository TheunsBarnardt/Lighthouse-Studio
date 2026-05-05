# Runbook: Adding a New Locale

**Applies to:** Platform contributors and operators customising language support  
**Last updated:** 2026-05-05

## Overview

The auth and account UI is fully internationalised via `next-intl`. All user-visible strings are keyed in `apps/web/messages/en.json`. Adding a new locale requires: translating the message file, registering the locale, and deploying.

## Step 1: Translate the message file

Copy `apps/web/messages/en.json` to `apps/web/messages/<locale>.json` (e.g., `fr.json` for French).

Translate every value in the JSON file. Keys must remain identical to the English file. Do not translate key names.

Example (partial):

```json
{
  "auth": {
    "signIn": {
      "title": "Connexion",
      "emailLabel": "Adresse e-mail",
      "passwordLabel": "Mot de passe",
      "submit": "Se connecter"
    }
  }
}
```

## Step 2: Register the locale

In `apps/web/src/i18n/request.ts`, add the new locale to the `locales` array:

```typescript
export const locales = ['en', 'fr'] as const;
```

And update the `getRequestConfig` function to load the new messages file:

```typescript
const messages = (await import(`../../messages/${locale}.json`)).default;
```

(If the import is already dynamic based on `locale`, this step may be a no-op.)

## Step 3: Test the locale

Run the development server:

```
pnpm dev --filter @platform/web
```

Override the locale via the `Accept-Language` header (use a browser extension or curl) or set the user preference in the database:

```
UPDATE users SET preferences = jsonb_set(preferences, '{locale}', '"fr"') WHERE email = 'test@example.com';
```

Navigate to `/auth/sign-in` and verify strings appear in French.

## Step 4: Check for missing keys

Missing translation keys fall back to the key name (e.g., `auth.signIn.title`). Search the UI for raw key names appearing as text to find missing translations.

With the `next-intl` TypeScript plugin enabled, build-time type checking catches missing keys:

```
pnpm typecheck --filter @platform/web
```

## Step 5: Deploy

Deploy as a normal release. No database migrations are required for locale additions.

## Troubleshooting

### Strings still appear in English

Check that:

- The `messages/fr.json` file is present and valid JSON
- The locale is registered in `src/i18n/request.ts`
- The user's preference is set correctly (or `Accept-Language` header is being parsed)
- The deployment includes the new message file (check build output)

### JSON syntax error in message file

Use `jq . messages/fr.json` to validate. A syntax error causes `next-intl` to fall back to English for all strings in that file.
