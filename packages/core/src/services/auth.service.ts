import type { AuditPort } from '@platform/ports-audit';
import type {
  AuthorizationPort,
  RequestContext,
  SystemContext,
} from '@platform/ports-authorization';
import type {
  IdentityProviderPort,
  SessionPort,
  SignInChallenge,
  SignInMethod,
  UserDirectoryPort,
  VerifiedIdentity,
} from '@platform/ports-identity';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, makeSystemContext, toAuditActor } from '../context.js';
import {
  AuthenticationError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  ValidationError,
} from '../errors.js';
import { observable } from '../observability/observable.js';

// ── Input schemas ──────────────────────────────────────────────────────────────

const BeginSignInSchema = z.object({
  method: z.enum(['password', 'magic_link', 'oauth', 'oidc', 'saml']),
  email: z.string().email().optional(),
  password: z.string().optional(),
  redirectUri: z.string().url().optional(),
  provider: z.string().optional(),
});

const CompleteSignInSchema = z.object({
  method: z.enum(['password', 'magic_link', 'oauth', 'oidc', 'saml']),
  challengeId: z.string().optional(),
  code: z.string().optional(),
  state: z.string().optional(),
  mfaCode: z.string().optional(),
});

export type BeginSignInInput = z.infer<typeof BeginSignInSchema>;
export type CompleteSignInInput = z.infer<typeof CompleteSignInSchema>;

export interface SignInResult {
  challenge: SignInChallenge;
}

export interface SessionResult {
  token: string;
  userId: string;
  expiresAt: Date;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Coordinates sign-in, sign-out, and token verification flows.
 *
 * This service is thin: authentication logic lives in the IdentityProviderPort
 * adapter (which owns password hashing, MFA, SAML, etc.). This service adds:
 *   - Input validation
 *   - Session lifecycle management (create/refresh/revoke)
 *   - Audit trail for all auth events
 *   - Observable instrumentation
 *
 * Canonical shape: validate → authorize → precondition → execute → audit → return
 */
export class AuthService {
  readonly beginSignIn!: (
    ctx: SystemContext,
    input: BeginSignInInput,
  ) => Promise<Result<SignInResult, AppError>>;
  readonly completeSignIn!: (
    ctx: SystemContext,
    input: CompleteSignInInput,
  ) => Promise<Result<SessionResult, AppError>>;
  readonly signOut!: (ctx: RequestContext, sessionId: string) => Promise<Result<void, AppError>>;
  readonly verifyToken!: (
    ctx: SystemContext,
    token: string,
  ) => Promise<Result<{ userId: string; identity: VerifiedIdentity }, AppError>>;
  readonly revokeAllSessions!: (
    ctx: RequestContext,
    targetUserId: string,
  ) => Promise<Result<void, AppError>>;

  constructor(
    private readonly idp: IdentityProviderPort,
    private readonly sessions: SessionPort,
    private readonly directory: UserDirectoryPort,
    private readonly authz: AuthorizationPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'AuthService';
    this.beginSignIn = observable(s, 'beginSignIn', obs, this._beginSignIn.bind(this));
    this.completeSignIn = observable(s, 'completeSignIn', obs, this._completeSignIn.bind(this));
    this.signOut = observable(s, 'signOut', obs, this._signOut.bind(this));
    this.verifyToken = observable(s, 'verifyToken', obs, this._verifyToken.bind(this));
    this.revokeAllSessions = observable(
      s,
      'revokeAllSessions',
      obs,
      this._revokeAllSessions.bind(this),
    );
  }

  private async _beginSignIn(
    ctx: SystemContext,
    input: BeginSignInInput,
  ): Promise<Result<SignInResult, AppError>> {
    // 1. Validate
    const parsed = BeginSignInSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid sign-in input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Execute — no authz check; the IdP enforces lockout/rate limits
    const challengeResult = await this.idp.beginSignIn({
      method: parsed.data.method as SignInMethod,
      ...(parsed.data.email !== undefined && { email: parsed.data.email }),
      ...(parsed.data.password !== undefined && { password: parsed.data.password }),
      ...(parsed.data.redirectUri !== undefined && { redirectUri: parsed.data.redirectUri }),
      ...(parsed.data.provider !== undefined && { provider: parsed.data.provider }),
    });
    if (challengeResult.isErr()) {
      this.logger.info('Sign-in begin failed', {
        method: parsed.data.method,
        error: challengeResult.error.code,
      });
      return err(new AuthenticationError(challengeResult.error.message));
    }

    // 3. Audit
    await this.audit.write({
      eventType: 'auth.signin.started',
      actor: { kind: 'system', id: null },
      resource: { type: 'session', id: 'pending' },
      action: 'signin_started',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { method: parsed.data.method },
    });

    return ok({ challenge: challengeResult.value });
  }

  private async _completeSignIn(
    ctx: SystemContext,
    input: CompleteSignInInput,
  ): Promise<Result<SessionResult, AppError>> {
    // 1. Validate
    const parsed = CompleteSignInSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid sign-in completion input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Execute — complete the challenge at the IdP
    const identityResult = await this.idp.completeSignIn({
      method: parsed.data.method as SignInMethod,
      ...(parsed.data.challengeId !== undefined && { challengeId: parsed.data.challengeId }),
      ...(parsed.data.code !== undefined && { code: parsed.data.code }),
      ...(parsed.data.state !== undefined && { state: parsed.data.state }),
      ...(parsed.data.mfaCode !== undefined && { mfaCode: parsed.data.mfaCode }),
    });
    if (identityResult.isErr()) {
      await this.audit.write({
        eventType: 'auth.signin.failed',
        actor: { kind: 'system', id: null },
        resource: { type: 'session', id: 'pending' },
        action: 'signin_failed',
        outcome: 'failure',
        reason: identityResult.error.code,
        correlationId: ctx.correlationId,
        metadata: { method: parsed.data.method },
      });
      return err(new AuthenticationError(identityResult.error.message));
    }

    const identity: VerifiedIdentity = identityResult.value;

    // 3. Precondition: user must exist in the directory
    const userResult = await this.directory.findByIdentity(identity.providerId, identity.subject);
    if (userResult.isErr()) {
      return err(new InternalError('Directory lookup failed', { cause: userResult.error }));
    }
    if (!userResult.value) {
      return err(new NotFoundError('user', identity.subject));
    }
    const user = userResult.value;

    // 4. Create session
    const sessionResult = await this.sessions.create({
      userId: user.id,
      identityProvider: identity.providerId,
    });
    if (sessionResult.isErr()) {
      return err(new InternalError('Session creation failed', { cause: sessionResult.error }));
    }
    const { session, token } = sessionResult.value;

    // 5. Reset failed login counter on success
    await this.directory.resetFailedLogins(user.id);

    // 6. Audit
    await this.audit.write({
      eventType: 'auth.signin.succeeded',
      actor: { kind: 'user', id: user.id },
      resource: { type: 'session', id: session.id },
      action: 'signin_succeeded',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { method: parsed.data.method, identityProvider: identity.providerId },
    });

    this.logger.info('Sign-in completed', { userId: user.id, sessionId: session.id });

    return ok({ token, userId: user.id, expiresAt: session.expiresAt });
  }

  private async _signOut(ctx: RequestContext, sessionId: string): Promise<Result<void, AppError>> {
    // 1. Validate
    if (!sessionId || typeof sessionId !== 'string') {
      return err(new ValidationError('sessionId is required'));
    }

    // 2. Execute
    const revokeResult = await this.sessions.revoke(sessionId);
    if (revokeResult.isErr()) {
      return err(new NotFoundError('session', sessionId));
    }

    // 3. Audit
    await this.audit.write({
      eventType: 'auth.signout',
      actor: toAuditActor(ctx),
      resource: { type: 'session', id: sessionId },
      action: 'signout',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _verifyToken(
    ctx: SystemContext,
    token: string,
  ): Promise<Result<{ userId: string; identity: VerifiedIdentity }, AppError>> {
    // 1. Validate
    if (!token || typeof token !== 'string') {
      return err(new ValidationError('token is required'));
    }

    // 2. Execute — verify at the IdP
    const verifyResult = await this.idp.verifyToken(token);
    if (verifyResult.isErr()) {
      return err(new AuthenticationError(verifyResult.error.message));
    }

    const identity = verifyResult.value;

    // 3. Lookup user in directory
    const userResult = await this.directory.findByIdentity(identity.providerId, identity.subject);
    if (userResult.isErr()) {
      return err(new InternalError('Directory lookup failed', { cause: userResult.error }));
    }
    if (!userResult.value) {
      return err(new AuthenticationError('Token valid but user not found in directory'));
    }

    // No audit here — high-frequency path; rely on access logs
    this.logger.debug('Token verified', { correlationId: ctx.correlationId });

    return ok({ userId: userResult.value.id, identity });
  }

  private async _revokeAllSessions(
    ctx: RequestContext,
    targetUserId: string,
  ): Promise<Result<void, AppError>> {
    // 1. Validate
    if (!targetUserId || typeof targetUserId !== 'string') {
      return err(new ValidationError('targetUserId is required'));
    }

    // 2. Authorize — must be self or installation admin
    if (ctx.userId !== targetUserId) {
      const authResult = await this.authz.authorize(ctx, 'session.revoke_all', 'session');
      if (authResult.isErr()) {
        return err(new ForbiddenError(authResult.error.message));
      }
    }

    // 3. Execute
    const revokeResult = await this.sessions.revokeAllForUser(targetUserId);
    if (revokeResult.isErr()) {
      return err(new InternalError('Session revocation failed', { cause: revokeResult.error }));
    }

    // 4. Audit
    await this.audit.write({
      eventType: 'auth.sessions.revoked_all',
      actor: toAuditActor(ctx),
      resource: { type: 'session', id: targetUserId },
      action: 'revoked_all',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { targetUserId },
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }
}

// Re-export for composition root
export { makeSystemContext };
