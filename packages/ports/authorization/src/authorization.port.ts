import type { Result } from 'neverthrow';

import type { AuthorizationError } from './errors.js';
import type {
  AuthorizationExplanation,
  EffectivePermissionSet,
  RequestContext,
  ResourceContext,
} from './types.js';

export interface AuthorizationPort {
  /**
   * Decide whether the principal in `ctx` may perform `action` on `resourceType`.
   * Returns ok(undefined) on allow, err(AuthorizationError) on deny.
   *
   * Deny events are always logged at info; grant events at debug.
   */
  authorize(
    ctx: RequestContext,
    action: string,
    resourceType: string,
    resourceContext?: ResourceContext,
  ): Promise<Result<void, AuthorizationError>>;

  /**
   * Return every permission the principal holds in the given workspace.
   * Cached per request; used by the UI to disable controls before the user acts.
   */
  listEffectivePermissions(
    ctx: RequestContext,
    workspaceId: string,
  ): Promise<Result<EffectivePermissionSet, AuthorizationError>>;

  /**
   * Explain why a decision was or would be made.
   * Returns the role chain and matched rules for admin debugging and UI tooltips.
   */
  explain(
    ctx: RequestContext,
    action: string,
    resourceType: string,
  ): Promise<Result<AuthorizationExplanation, AuthorizationError>>;
}
