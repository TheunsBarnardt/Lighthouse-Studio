import { z } from 'zod';

export type IdentityFeature =
  | 'password'
  | 'magic_link'
  | 'oauth'
  | 'oidc'
  | 'saml'
  | 'mfa_totp'
  | 'mfa_webauthn'
  | 'mfa_sms'
  | 'self_service_signup'
  | 'self_service_password_reset';

export interface VerifiedIdentity {
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  claims: Record<string, unknown>;
  providerId: string;
}

export type SignInMethod = 'password' | 'magic_link' | 'oauth' | 'oidc' | 'saml';

export interface SignInInput {
  method: SignInMethod;
  email?: string;
  password?: string;
  redirectUri?: string;
  provider?: string;
}

export type SignInChallenge =
  | { kind: 'redirect'; url: string }
  | { kind: 'mfa_required'; challengeId: string; mfaMethods: string[] }
  | { kind: 'complete'; identity: VerifiedIdentity };

export interface SignInCompletion {
  method: SignInMethod;
  challengeId?: string;
  code?: string;
  state?: string;
  mfaCode?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastSignInAt?: Date;
  archivedAt?: Date | null;
  metadata: Record<string, unknown>;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export type MfaMethod = 'totp' | 'webauthn' | 'sms';

export interface MfaChallenge {
  challengeId: string;
  method: MfaMethod;
  expiresAt: Date;
}

export const SignInInputSchema = z.object({
  method: z.enum(['password', 'magic_link', 'oauth', 'oidc', 'saml']),
  email: z.string().email().optional(),
  password: z.string().optional(),
  redirectUri: z.string().url().optional(),
  provider: z.string().optional(),
});
