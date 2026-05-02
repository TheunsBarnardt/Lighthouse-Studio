import type {
  IdentityError,
  IdentityFeature,
  IdentityProviderMetadata,
  IdentityProviderPort,
  SessionPort,
  SignInChallenge,
  SignInCompletion,
  SignInInput,
  UserDirectoryPort,
  VerifiedIdentity,
} from '@platform/ports-identity';
import type { Result } from 'neverthrow';

import { IdentityError as IE } from '@platform/ports-identity';
import { err, ok } from 'neverthrow';

import type { EmailVerificationFlow } from './flows/email-verification.js';
import type { MagicLinkFlow } from './flows/magic-link.js';
import type { PasswordResetFlow } from './flows/password-reset.js';
import type { OAuthRouter } from './oauth.js';

import { isPwnedPassword, validatePasswordLength, MIN_PASSWORD_LENGTH } from './hibp.js';
import { hashPassword, needsRehash, verifyPassword } from './password.js';

const PROVIDER_ID = 'builtin';

export interface BuiltinProviderConfig {
  /** Whether self-service signup is allowed. */
  selfServiceSignup: boolean;
  /** Whether to check passwords against HaveIBeenPwned. Defaults to true. */
  hibpCheck?: boolean;
}

export interface BuiltinIdentityProviderDeps {
  userDirectory: UserDirectoryPort;
  sessions: SessionPort;
  emailVerification: EmailVerificationFlow;
  passwordReset: PasswordResetFlow;
  magicLink: MagicLinkFlow;
  oauth?: OAuthRouter;
}

/**
 * The platform's built-in identity provider.
 *
 * Implements IdentityProviderPort for the Supabase-clone auth feature:
 * email/password, magic link, OAuth (Google, GitHub, Microsoft), and TOTP MFA.
 *
 * Delegates MFA verification to BuiltinMfaAdapter (injected separately).
 * Delegates user directory operations to UserDirectoryPort.
 * Delegates session management to SessionPort.
 */
export class BuiltinIdentityProvider implements IdentityProviderPort {
  constructor(
    private readonly deps: BuiltinIdentityProviderDeps,
    private readonly config: BuiltinProviderConfig,
  ) {}

  // ── IdentityProviderPort ─────────────────────────────────────────────────

  async beginSignIn(input: SignInInput): Promise<Result<SignInChallenge, IdentityError>> {
    switch (input.method) {
      case 'password':
        return this.beginPasswordSignIn(input);
      case 'magic_link':
        return this.beginMagicLink(input);
      case 'oauth':
        return this.beginOAuth(input);
      default:
        return err(new IE('NOT_SUPPORTED', `Sign-in method not supported: ${input.method}`));
    }
  }

  async completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>> {
    switch (input.method) {
      case 'oauth':
        return this.completeOAuth(input);
      case 'magic_link':
        return this.completeMagicLink(input);
      default:
        return err(new IE('NOT_SUPPORTED', `completeSignIn not applicable for: ${input.method}`));
    }
  }

  async verifyToken(token: string): Promise<Result<VerifiedIdentity, IdentityError>> {
    const session = (await this.deps.sessions.findByToken(token))._unsafeUnwrap();
    if (!session) {
      return err(new IE('TOKEN_INVALID', 'Session token is invalid or expired'));
    }

    const user = (await this.deps.userDirectory.findById(session.userId))._unsafeUnwrap();
    if (!user) {
      return err(new IE('ACCOUNT_NOT_FOUND', 'User not found for this session'));
    }
    if (user.status === 'archived') {
      return err(new IE('ACCOUNT_NOT_FOUND', 'Account has been archived'));
    }

    await this.deps.sessions.touch(session.id);

    const primaryIdentity =
      user.identities.find((i) => i.providerId === PROVIDER_ID && i.primary) ?? user.identities[0];

    return ok({
      subject: primaryIdentity?.subject ?? user.id,
      providerId: PROVIDER_ID,
      emailVerified: user.emailVerified,
      claims: { userId: user.id, status: user.status },
      ...(user.primaryEmail ? { email: user.primaryEmail } : {}),
      ...(user.displayName ? { displayName: user.displayName } : {}),
    });
  }

  async signOut(token: string): Promise<Result<void, IdentityError>> {
    const session = (await this.deps.sessions.findByToken(token))._unsafeUnwrap();
    if (!session) return ok(undefined); // idempotent
    await this.deps.sessions.revoke(session.id);
    return ok(undefined);
  }

  supports(feature: IdentityFeature): boolean {
    const supported: IdentityFeature[] = [
      'password',
      'magic_link',
      'self_service_signup',
      'self_service_password_reset',
      'mfa_totp',
      'rp_initiated_logout',
    ];
    if (this.deps.oauth) {
      supported.push('oauth');
    }
    return supported.includes(feature);
  }

  getMetadata(): IdentityProviderMetadata {
    const capabilities: IdentityFeature[] = [
      'password',
      'magic_link',
      'self_service_signup',
      'self_service_password_reset',
      'mfa_totp',
      'rp_initiated_logout',
    ];
    if (this.deps.oauth) {
      capabilities.push('oauth');
    }
    return {
      id: PROVIDER_ID,
      displayName: 'Built-in Auth',
      capabilities,
    };
  }

  // ── Private flow implementations ────────────────────────────────────────────

  private async beginPasswordSignIn(
    input: SignInInput,
  ): Promise<Result<SignInChallenge, IdentityError>> {
    if (!input.email || !input.password) {
      return err(new IE('INVALID_STATE', 'Email and password are required'));
    }

    const user = (await this.deps.userDirectory.findByEmail(input.email))._unsafeUnwrap();

    // Use a constant-time response to prevent email enumeration
    if (!user || user.status === 'archived') {
      return err(new IE('INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    const lockout = (await this.deps.userDirectory.isLockedOut(user.id))._unsafeUnwrap();
    if (lockout.locked) {
      return err(
        new IE('ACCOUNT_LOCKED', 'Account is temporarily locked due to too many failed attempts'),
      );
    }

    const storedHash = (await this.deps.userDirectory.getPasswordHash(user.id))._unsafeUnwrap();
    if (!storedHash) {
      return err(new IE('INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    const valid = await verifyPassword(input.password, storedHash);
    if (!valid) {
      await this.deps.userDirectory.recordFailedLogin(user.id, '');
      return err(new IE('INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    // Reset failure counter on success
    await this.deps.userDirectory.resetFailedLogins(user.id);

    // Re-hash if parameters are outdated
    if (needsRehash(storedHash)) {
      const newHash = await hashPassword(input.password);
      await this.deps.userDirectory.setPasswordHash(user.id, newHash);
    }

    // Check if MFA is required
    const mfaSecret = (await this.deps.userDirectory.getMfaSecret(user.id))._unsafeUnwrap();
    if (mfaSecret && mfaSecret.ciphertext !== '') {
      const challengeId = crypto.randomUUID();
      return ok({ kind: 'mfa_required', challengeId, mfaMethods: ['totp'] });
    }

    // Return identity directly (MFA not enrolled)
    const primaryIdentity =
      user.identities.find((i) => i.providerId === PROVIDER_ID && i.primary) ?? user.identities[0];

    return ok({
      kind: 'complete',
      identity: {
        subject: primaryIdentity?.subject ?? user.id,
        providerId: PROVIDER_ID,
        emailVerified: user.emailVerified,
        claims: { userId: user.id },
        ...(user.primaryEmail ? { email: user.primaryEmail } : {}),
        ...(user.displayName ? { displayName: user.displayName } : {}),
      },
    });
  }

  private async beginMagicLink(
    input: SignInInput,
  ): Promise<Result<SignInChallenge, IdentityError>> {
    if (!input.email) {
      return err(new IE('INVALID_STATE', 'Email is required for magic link sign-in'));
    }
    await this.deps.magicLink.send(input.email);
    return ok({ kind: 'magic_link_sent' });
  }

  private async beginOAuth(input: SignInInput): Promise<Result<SignInChallenge, IdentityError>> {
    if (!this.deps.oauth) {
      return err(new IE('NOT_SUPPORTED', 'OAuth is not configured'));
    }
    if (!input.provider) {
      return err(new IE('INVALID_STATE', 'OAuth provider is required'));
    }
    const result = await this.deps.oauth.beginFlow(input.provider, input.redirectUri);
    if (result.isErr()) return err(result.error);
    return ok({ kind: 'redirect', url: result.value.authUrl });
  }

  private async completeOAuth(
    input: SignInCompletion,
  ): Promise<Result<VerifiedIdentity, IdentityError>> {
    if (!this.deps.oauth) {
      return err(new IE('NOT_SUPPORTED', 'OAuth is not configured'));
    }
    if (!input.code || !input.state) {
      return err(new IE('INVALID_STATE', 'OAuth callback requires code and state'));
    }
    return this.deps.oauth.completeFlow(input.code, input.state);
  }

  private async completeMagicLink(
    input: SignInCompletion,
  ): Promise<Result<VerifiedIdentity, IdentityError>> {
    if (!input.code) {
      return err(new IE('INVALID_STATE', 'Magic link token is required'));
    }
    const result = await this.deps.magicLink.consume(input.code);
    if (result.isErr()) return err(result.error);

    const user = (await this.deps.userDirectory.findById(result.value.userId))._unsafeUnwrap();
    if (!user) {
      return err(new IE('ACCOUNT_NOT_FOUND', 'User not found for magic link'));
    }

    const primaryIdentity =
      user.identities.find((i) => i.providerId === PROVIDER_ID && i.primary) ?? user.identities[0];

    return ok({
      subject: primaryIdentity?.subject ?? user.id,
      providerId: PROVIDER_ID,
      emailVerified: user.emailVerified,
      claims: { userId: user.id },
      ...(user.primaryEmail ? { email: user.primaryEmail } : {}),
      ...(user.displayName ? { displayName: user.displayName } : {}),
    });
  }

  // ── Signup helper (not on the port; called by the service layer) ──────────

  /**
   * Register a new user with email and password.
   * Validates password length, checks HIBP, hashes, stores, and sends
   * an email verification email.
   */
  async signup(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<Result<{ userId: string }, IdentityError>> {
    if (!this.config.selfServiceSignup) {
      return err(new IE('NOT_SUPPORTED', 'Self-service signup is disabled'));
    }

    if (!validatePasswordLength(password)) {
      return err(
        new IE(
          'INVALID_STATE',
          `Password must be at least ${String(MIN_PASSWORD_LENGTH)} characters`,
        ),
      );
    }

    if (this.config.hibpCheck !== false) {
      const pwned = await isPwnedPassword(password);
      if (pwned) {
        return err(
          new IE(
            'INVALID_STATE',
            'This password has appeared in a data breach. Please choose a different password.',
          ),
        );
      }
    }

    const subject = crypto.randomUUID();
    const createResult = await this.deps.userDirectory.create({
      email,
      ...(displayName !== undefined ? { displayName } : {}),
      identity: {
        providerId: PROVIDER_ID,
        subject,
        email,
        emailVerified: false,
        primary: true,
      },
    });

    if (createResult.isErr()) return err(createResult.error);
    const user = createResult.value;

    const passwordHash = await hashPassword(password);
    await this.deps.userDirectory.setPasswordHash(user.id, passwordHash);

    await this.deps.emailVerification.send(user.id, email);

    return ok({ userId: user.id });
  }
}
