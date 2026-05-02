import type { Result } from 'neverthrow';

import type { IdentityError } from './errors.js';
import type {
  IdentityFeature,
  SignInChallenge,
  SignInCompletion,
  SignInInput,
  VerifiedIdentity,
} from './types.js';

export interface IdentityProviderPort {
  beginSignIn(input: SignInInput): Promise<Result<SignInChallenge, IdentityError>>;
  completeSignIn(input: SignInCompletion): Promise<Result<VerifiedIdentity, IdentityError>>;
  verifyToken(token: string): Promise<Result<VerifiedIdentity, IdentityError>>;
  signOut(token: string): Promise<Result<void, IdentityError>>;
  supports(feature: IdentityFeature): boolean;
}
