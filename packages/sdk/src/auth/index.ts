import type { HttpTransport } from '../transport/index.js';

import { uuidv4 } from '../util.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  userId: string;
  workspaceId: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
}

export interface AuthChallenge {
  type: 'mfa' | 'email_verification';
  challengeId: string;
}

export interface MfaEnrollment {
  otpAuthUri: string;
  secret: string;
}

export type AuthStateEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED';
import type { Unsubscribe } from '../shared-types.js';
export type { Unsubscribe };

export type AuthStorageStrategy = 'cookie' | 'localStorage' | 'memory';

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInProviderOptions {
  redirectTo?: string;
  scopes?: string[];
}

export interface ProfileUpdate {
  displayName?: string;
  avatarUrl?: string;
}

// ── Storage implementations ───────────────────────────────────────────────────

interface TokenStorage {
  getSession(): Session | null;
  setSession(s: Session): void;
  clearSession(): void;
}

class MemoryTokenStorage implements TokenStorage {
  private session: Session | null = null;
  getSession() {
    return this.session;
  }
  setSession(s: Session) {
    this.session = s;
  }
  clearSession() {
    this.session = null;
  }
}

class LocalStorageTokenStorage implements TokenStorage {
  private readonly key = '__platform_session__';
  getSession(): Session | null {
    try {
      const ls = globalThis.localStorage as Storage | undefined;
      const raw = ls?.getItem(this.key);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }
  setSession(s: Session): void {
    try {
      (globalThis.localStorage as Storage | undefined)?.setItem(this.key, JSON.stringify(s));
    } catch {
      /* noop */
    }
  }
  clearSession(): void {
    try {
      (globalThis.localStorage as Storage | undefined)?.removeItem(this.key);
    } catch {
      /* noop */
    }
  }
}

function createStorage(strategy: AuthStorageStrategy): TokenStorage {
  if (strategy === 'localStorage') return new LocalStorageTokenStorage();
  // cookie: server sets HttpOnly cookies; client reads session from /auth/session
  // For cookie mode we still keep an in-memory copy for synchronous getSession()
  return new MemoryTokenStorage();
}

// ── AuthClient ────────────────────────────────────────────────────────────────

export interface AuthClientOptions {
  transport: HttpTransport;
  storageStrategy?: AuthStorageStrategy | undefined;
  onSessionChange?: ((session: Session | null) => void) | undefined;
}

export class AuthClient {
  private readonly transport: HttpTransport;
  private readonly storage: TokenStorage;
  private readonly listeners = new Map<
    string,
    (event: AuthStateEvent, session: Session | null) => void
  >();
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: AuthClientOptions) {
    this.transport = opts.transport;
    this.storage = createStorage(opts.storageStrategy ?? 'memory');
    const existingSession = this.storage.getSession();
    if (existingSession) this.scheduleRefresh(existingSession);
  }

  // ── Sign-in ────────────────────────────────────────────────────────────────

  async signIn(
    input: SignInInput,
  ): Promise<{ session: Session; user: User } | { challenge: AuthChallenge }> {
    const result = await this.transport.request<
      { session: Session; user: User } | { challenge: AuthChallenge }
    >({ method: 'POST', path: '/api/v1/auth/sign-in', body: input, noIdempotency: true });

    if ('session' in result) {
      this.storeSession(result.session);
      this.emit('SIGNED_IN', result.session);
    }
    return result;
  }

  async signInWithMagicLink(input: { email: string }): Promise<void> {
    await this.transport.request({ method: 'POST', path: '/api/v1/auth/magic-link', body: input });
  }

  signInWithProvider(provider: string, opts?: SignInProviderOptions): void {
    const params = new URLSearchParams({ provider });
    if (opts?.redirectTo) params.set('redirectTo', opts.redirectTo);
    if (opts?.scopes) params.set('scopes', opts.scopes.join(' '));
    (globalThis.location as Location | undefined)?.assign(
      `/api/v1/auth/oauth?${params.toString()}`,
    );
  }

  signInWithSaml(idpId: string): void {
    (globalThis.location as Location | undefined)?.assign(`/api/v1/auth/saml/${idpId}`);
  }

  // ── MFA ───────────────────────────────────────────────────────────────────

  async completeMfaChallenge(input: { code: string }): Promise<{ session: Session; user: User }> {
    const result = await this.transport.request<{ session: Session; user: User }>({
      method: 'POST',
      path: '/api/v1/auth/mfa/verify',
      body: input,
      noIdempotency: true,
    });
    this.storeSession(result.session);
    this.emit('SIGNED_IN', result.session);
    return result;
  }

  async enrollMfa(): Promise<MfaEnrollment> {
    return this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/mfa/enroll',
      noIdempotency: true,
    });
  }

  async confirmMfaEnrollment(code: string): Promise<{ recoveryCodes: string[] }> {
    return this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/mfa/confirm',
      body: { code },
    });
  }

  async disableMfa(): Promise<void> {
    await this.transport.request({ method: 'DELETE', path: '/api/v1/auth/mfa' });
  }

  // ── Sign-up ───────────────────────────────────────────────────────────────

  async signUp(input: SignUpInput): Promise<{ user: User; verificationRequired: boolean }> {
    return this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/sign-up',
      body: input,
      idempotencyKey: uuidv4(),
    });
  }

  // ── Verification & reset ──────────────────────────────────────────────────

  async resendEmailVerification(email: string): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/email/resend',
      body: { email },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/email/verify',
      body: { token },
    });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/password/reset-request',
      body: { email },
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/password/reset',
      body: { token, newPassword },
    });
  }

  // ── Session ───────────────────────────────────────────────────────────────

  async signOut(opts?: { everywhere?: boolean }): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/sign-out',
      body: { everywhere: opts?.everywhere ?? false },
      noIdempotency: true,
    });
    this.clearSession();
    this.emit('SIGNED_OUT', null);
  }

  getSession(): Session | null {
    const s = this.storage.getSession();
    if (!s) return null;
    if (Date.now() >= s.expiresAt) return null; // expired
    return s;
  }

  async refreshSession(): Promise<Session> {
    const current = this.storage.getSession();
    const session = await this.transport.request<Session>({
      method: 'POST',
      path: '/api/v1/auth/session/refresh',
      body: { refreshToken: current?.refreshToken ?? null },
      noIdempotency: true,
    });
    this.storeSession(session);
    this.emit('TOKEN_REFRESHED', session);
    return session;
  }

  onAuthStateChange(
    handler: (event: AuthStateEvent, session: Session | null) => void,
  ): Unsubscribe {
    const id = uuidv4();
    this.listeners.set(id, handler);
    return () => {
      this.listeners.delete(id);
    };
  }

  // ── Account ───────────────────────────────────────────────────────────────

  async updateProfile(input: ProfileUpdate): Promise<User> {
    const user = await this.transport.request<User>({
      method: 'PATCH',
      path: '/api/v1/auth/me',
      body: input,
    });
    this.emit('USER_UPDATED', this.storage.getSession());
    return user;
  }

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/password/change',
      body: input,
    });
  }

  async changeEmail(input: { newEmail: string; password: string }): Promise<void> {
    await this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/email/change',
      body: input,
    });
  }

  linkIdentity(provider: string): void {
    (globalThis.location as Location | undefined)?.assign(
      `/api/v1/auth/identity/link?provider=${provider}`,
    );
  }

  async unlinkIdentity(provider: string): Promise<void> {
    await this.transport.request({ method: 'DELETE', path: `/api/v1/auth/identity/${provider}` });
  }

  async listSessions(): Promise<Session[]> {
    return this.transport.request({ path: '/api/v1/auth/sessions' });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.transport.request({ method: 'DELETE', path: `/api/v1/auth/sessions/${sessionId}` });
  }

  async requestAccountDeletion(reason?: string): Promise<{ scheduledFor: Date }> {
    return this.transport.request({
      method: 'POST',
      path: '/api/v1/auth/account/delete-request',
      body: { reason },
    });
  }

  async cancelAccountDeletion(): Promise<void> {
    await this.transport.request({ method: 'DELETE', path: '/api/v1/auth/account/delete-request' });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  getToken(): string | null {
    return this.storage.getSession()?.accessToken ?? null;
  }

  private storeSession(session: Session): void {
    this.storage.setSession(session);
    this.scheduleRefresh(session);
  }

  private clearSession(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.storage.clearSession();
  }

  private scheduleRefresh(session: Session): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const msUntilExpiry = session.expiresAt - Date.now();
    const msUntilRefresh = Math.max(msUntilExpiry - 60_000, 0); // refresh 60s early
    if (msUntilRefresh < 1) {
      void this.refreshSession().catch(() => {
        /* expired — app will get SIGNED_OUT on next call */
      });
      return;
    }
    // Cap at 2^31-1 to avoid 32-bit setTimeout overflow (Node.js clamps to 1ms on overflow)
    const delay = Math.min(msUntilRefresh, 2_147_483_647);
    this.refreshTimer = setTimeout(() => {
      void this.refreshSession().catch(() => {
        this.clearSession();
        this.emit('SIGNED_OUT', null);
      });
    }, delay);
  }

  private emit(event: AuthStateEvent, session: Session | null): void {
    for (const handler of Array.from(this.listeners.values())) {
      try {
        handler(event, session);
      } catch {
        /* listener errors don't affect SDK */
      }
    }
  }
}
