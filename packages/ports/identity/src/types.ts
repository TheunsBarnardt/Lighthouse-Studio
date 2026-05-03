import { z } from 'zod';

// ── Feature capability flags ──────────────────────────────────────────────────

export type IdentityFeature =
  | 'password'
  | 'magic_link'
  | 'oauth'
  | 'oidc'
  | 'saml'
  | 'sso'
  | 'mfa_totp'
  | 'mfa_webauthn'
  | 'mfa_sms'
  | 'self_service_signup'
  | 'self_service_password_reset'
  | 'rp_initiated_logout'
  | 'just_in_time_provisioning'
  | 'attribute_mapping'
  | 'group_sync';

// ── Sign-in flow ──────────────────────────────────────────────────────────────

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
  | { kind: 'magic_link_sent' }
  | { kind: 'complete'; identity: VerifiedIdentity };

export interface SignInCompletion {
  method: SignInMethod;
  challengeId?: string;
  code?: string;
  state?: string;
  mfaCode?: string;
}

export interface VerifiedIdentity {
  subject: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  claims: Record<string, unknown>;
  providerId: string;
}

export interface IdentityProviderMetadata {
  id: string;
  displayName: string;
  iconUrl?: string;
  capabilities: IdentityFeature[];
}

// ── User directory ────────────────────────────────────────────────────────────

export interface UserPreferences {
  locale?: string;
  timezone?: string;
  theme?: 'light' | 'dark' | 'system';
}

export interface Identity {
  providerId: string;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  primary: boolean;
  linkedAt: Date;
  lastUsedAt: Date | null;
}

export interface User {
  id: string;
  primaryEmail: string;
  emailVerified: boolean;
  displayName: string | null;
  status: 'active' | 'pending_verification' | 'archived';
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  identities: Identity[];
  mfaEnabled: boolean;
  preferences: UserPreferences;
}

export interface CreateUserInput {
  email: string;
  displayName?: string;
  identity: {
    providerId: string;
    subject: string;
    email?: string;
    emailVerified?: boolean;
    primary?: boolean;
  };
  preferences?: UserPreferences;
}

export interface ProfileUpdate {
  displayName?: string;
  preferences?: Partial<UserPreferences>;
}

export interface SearchOptions {
  query?: string;
  status?: 'active' | 'pending_verification' | 'archived' | 'all';
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

// ── Credentials (built-in auth adapter internal types, surfaced via port) ─────

export interface EncryptedSecret {
  ciphertext: string;
  keyVersion: string;
}

export interface VersionedHash {
  hash: string;
  version: number;
  algorithm: 'argon2id';
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  identityProvider: string;
  workspaceId: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
}

export interface CreateSessionInput {
  userId: string;
  identityProvider: string;
  workspaceId?: string;
  ipAddress?: string;
  userAgent?: string;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

// ── MFA ───────────────────────────────────────────────────────────────────────

export type MfaMethod = 'totp' | 'webauthn' | 'sms';

export interface MfaChallenge {
  challengeId: string;
  method: MfaMethod;
  expiresAt: Date;
}

export interface TotpEnrollment {
  secret: string;
  qrCodeData: string;
  expiresAt: Date;
}

export interface RecoveryCodes {
  codes: string[];
}

// ── Validation schemas ────────────────────────────────────────────────────────

export const SignInInputSchema = z.object({
  method: z.enum(['password', 'magic_link', 'oauth', 'oidc', 'saml']),
  email: z.string().email().optional(),
  password: z.string().optional(),
  redirectUri: z.string().url().optional(),
  provider: z.string().optional(),
});

// ── Backward-compatible aliases ───────────────────────────────────────────────

/** @deprecated Use User instead */
export type UserRecord = User;

/** @deprecated Use Session instead */
export type SessionRecord = Session;
