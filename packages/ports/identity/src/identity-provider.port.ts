import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type {
  IdentityFeature,
  IdentityProviderMetadata,
  SignInChallenge,
  SignInCompletion,
  SignInInput,
  VerifiedIdentity,
} from './types.js';

export interface IdentityProviderPort {
  /** Begin a sign-in flow. Returns the next challenge or immediate completion. */
  beginSignIn(input: SignInInput): Promise<Result<SignInChallenge, IdentityError>>;

  /** Complete a sign-in flow given the client's challenge response. */
  completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>>;

  /** Verify an existing session token and return the associated identity. */
  verifyToken(token: string): Promise<Result<VerifiedIdentity, IdentityError>>;

  /** Sign out — invalidate the local session; trigger RP-initiated logout if supported. */
  signOut(token: string): Promise<Result<void, IdentityError>>;

  /** Report whether a capability is supported by this provider. */
  supports(feature: IdentityFeature): boolean;

  /** Metadata for discovery and configuration UI. */
  getMetadata(): IdentityProviderMetadata;
}
