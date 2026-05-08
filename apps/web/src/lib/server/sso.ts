/**
 * SSO engine — Google, GitHub, Microsoft OAuth2/OIDC.
 * State stored in memory with a 10-minute TTL; survives Next.js HMR via globalThis.
 * PKCE (S256) enforced for Google and Microsoft; GitHub does not support it.
 */
import { getEnv } from '@platform/config';
import { createHash, randomBytes } from 'node:crypto';

// ─── State store ─────────────────────────────────────────────────────────────

interface SsoStateRecord {
  provider: string;
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
}

export interface SsoUserInfo {
  providerId: string;
  subject: string;
  email: string;
  displayName: string | undefined;
  emailVerified: boolean;
}

const g = globalThis as typeof globalThis & { _ssoStates?: Map<string, SsoStateRecord> };

function store(): Map<string, SsoStateRecord> {
  if (!g._ssoStates) g._ssoStates = new Map();
  return g._ssoStates;
}

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store()) if (v.expiresAt < now) store().delete(k);
}

function save(state: string, data: Omit<SsoStateRecord, 'expiresAt'>): void {
  prune();
  store().set(state, { ...data, expiresAt: Date.now() + 10 * 60 * 1000 });
}

function consume(state: string): SsoStateRecord | null {
  const rec = store().get(state);
  store().delete(state);
  if (!rec || rec.expiresAt < Date.now()) return null;
  return rec;
}

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function makeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function makeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function makeState(): string {
  return randomBytes(16).toString('hex');
}

function appUrl(): string {
  // NEXT_PUBLIC_APP_URL is a client-side Next.js env var — accessed directly by convention
  // eslint-disable-next-line no-restricted-syntax
  return process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
}

function redirectUri(): string {
  return `${appUrl()}/auth/oauth-callback`;
}

// ─── Provider availability ───────────────────────────────────────────────────

export const ssoProviders = {
  google: {
    enabled: () => !!(getEnv().GOOGLE_CLIENT_ID && getEnv().GOOGLE_CLIENT_SECRET),
    label: 'Google',
  },
  github: {
    enabled: () => !!(getEnv().GITHUB_CLIENT_ID && getEnv().GITHUB_CLIENT_SECRET),
    label: 'GitHub',
  },
  microsoft: {
    enabled: () => !!(getEnv().MICROSOFT_CLIENT_ID && getEnv().MICROSOFT_CLIENT_SECRET),
    label: 'Microsoft',
  },
} as const;

export type SsoProviderId = keyof typeof ssoProviders;

// ─── Begin flows ─────────────────────────────────────────────────────────────

function beginGoogle(returnTo: string): string {
  const state = makeState();
  const verifier = makeVerifier();
  save(state, { provider: 'google', codeVerifier: verifier, returnTo });

  return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: getEnv().GOOGLE_CLIENT_ID ?? '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: makeChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })}`;
}

function beginGithub(returnTo: string): string {
  const state = makeState();
  save(state, { provider: 'github', codeVerifier: '', returnTo });

  return `https://github.com/login/oauth/authorize?${new URLSearchParams({
    client_id: getEnv().GITHUB_CLIENT_ID ?? '',
    redirect_uri: redirectUri(),
    scope: 'read:user user:email',
    state,
  })}`;
}

function beginMicrosoft(returnTo: string): string {
  const tenant = getEnv().MICROSOFT_TENANT_ID ?? 'common';
  const state = makeState();
  const verifier = makeVerifier();
  save(state, { provider: 'microsoft', codeVerifier: verifier, returnTo });

  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${new URLSearchParams({
    client_id: getEnv().MICROSOFT_CLIENT_ID ?? '',
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile User.Read',
    state,
    code_challenge: makeChallenge(verifier),
    code_challenge_method: 'S256',
    response_mode: 'query',
  })}`;
}

export function beginSso(provider: string, returnTo: string): string | null {
  if (provider === 'google' && ssoProviders.google.enabled()) return beginGoogle(returnTo);
  if (provider === 'github' && ssoProviders.github.enabled()) return beginGithub(returnTo);
  if (provider === 'microsoft' && ssoProviders.microsoft.enabled()) return beginMicrosoft(returnTo);
  return null;
}

// ─── Complete flows ──────────────────────────────────────────────────────────

async function completeGoogle(rec: SsoStateRecord, code: string): Promise<SsoUserInfo> {
  const tokRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: getEnv().GOOGLE_CLIENT_ID ?? '',
      client_secret: getEnv().GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(),
      code_verifier: rec.codeVerifier,
    }),
  });
  if (!tokRes.ok) throw new Error(`Google token exchange failed: ${String(tokRes.status)}`);
  const tok = (await tokRes.json()) as { access_token: string };

  const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!uRes.ok) throw new Error('Google userinfo request failed');
  const u = (await uRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    email_verified?: boolean;
  };
  if (!u.email) throw new Error('Google did not return an email address');

  return {
    providerId: 'google',
    subject: u.sub,
    email: u.email,
    displayName: u.name,
    emailVerified: u.email_verified ?? false,
  };
}

async function completeGithub(rec: SsoStateRecord, code: string): Promise<SsoUserInfo> {
  const tokRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      client_id: getEnv().GITHUB_CLIENT_ID ?? '',
      client_secret: getEnv().GITHUB_CLIENT_SECRET ?? '',
      code,
      redirect_uri: redirectUri(),
    }),
  });
  if (!tokRes.ok) throw new Error('GitHub token exchange failed');
  const tok = (await tokRes.json()) as { access_token?: string; error?: string };
  if (!tok.access_token) throw new Error(tok.error ?? 'GitHub returned no access token');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${tok.access_token}`,
    'User-Agent': 'Lighthouse-Studio',
    Accept: 'application/vnd.github+json',
  };

  const uRes = await fetch('https://api.github.com/user', { headers });
  if (!uRes.ok) throw new Error('GitHub user API failed');
  const u = (await uRes.json()) as {
    id: number;
    login: string;
    name?: string;
    email?: string;
  };

  let email = u.email;
  if (!email) {
    const eRes = await fetch('https://api.github.com/user/emails', { headers });
    if (eRes.ok) {
      const emails = (await eRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email;
    }
  }
  if (!email) {
    throw new Error(
      'GitHub did not return an email. Enable email visibility in your GitHub settings.',
    );
  }

  // codeVerifier unused for GitHub (no PKCE support), suppress lint
  void rec.codeVerifier;

  return {
    providerId: 'github',
    subject: String(u.id),
    email,
    displayName: u.name ?? u.login,
    emailVerified: true,
  };
}

async function completeMicrosoft(rec: SsoStateRecord, code: string): Promise<SsoUserInfo> {
  const tenant = getEnv().MICROSOFT_TENANT_ID ?? 'common';
  const tokRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: getEnv().MICROSOFT_CLIENT_ID ?? '',
      client_secret: getEnv().MICROSOFT_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri(),
      code_verifier: rec.codeVerifier,
    }),
  });
  if (!tokRes.ok) throw new Error(`Microsoft token exchange failed: ${String(tokRes.status)}`);
  const tok = (await tokRes.json()) as { access_token: string };

  const uRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!uRes.ok) throw new Error('Microsoft Graph API request failed');
  const u = (await uRes.json()) as {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName?: string;
  };

  const email = u.mail ?? u.userPrincipalName ?? '';
  if (!email) throw new Error('Microsoft did not return an email address');

  return {
    providerId: 'microsoft',
    subject: u.id,
    email,
    displayName: u.displayName,
    emailVerified: true,
  };
}

export async function completeSso(
  code: string,
  state: string,
): Promise<SsoUserInfo & { returnTo: string }> {
  const rec = consume(state);
  if (!rec) throw new Error('OAuth state is invalid or expired — please try signing in again.');

  let info: SsoUserInfo;
  switch (rec.provider) {
    case 'google':
      info = await completeGoogle(rec, code);
      break;
    case 'github':
      info = await completeGithub(rec, code);
      break;
    case 'microsoft':
      info = await completeMicrosoft(rec, code);
      break;
    default:
      throw new Error(`Unknown SSO provider: ${rec.provider}`);
  }

  return { ...info, returnTo: rec.returnTo };
}
