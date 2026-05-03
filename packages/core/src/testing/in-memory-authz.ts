import type {
  AuthorizationPort,
  EffectivePermissionSet,
  RequestContext,
  ResourceContext,
} from '@platform/ports-authorization';

import { AuthorizationError } from '@platform/ports-authorization';
import { ok, err, type Result } from 'neverthrow';
// AuthorizationError constructor: (kind: AuthorizationErrorKind, message: string, cause?)

/**
 * In-memory AuthorizationPort for unit tests.
 *
 * By default, allows all operations. Pass `deny: true` to the factory to
 * create an adapter that denies everything (for testing authorization failure
 * paths). For fine-grained control, use `denyActions` to list specific
 * action strings that should be denied.
 */
export function createInMemoryAuthz(opts?: {
  deny?: boolean;
  denyActions?: string[];
}): AuthorizationPort {
  const denyAll = opts?.deny ?? false;
  const denyActions = new Set(opts?.denyActions ?? []);

  return {
    authorize(
      _ctx: RequestContext,
      action: string,
      _resourceType: string,
      _resourceContext?: ResourceContext,
    ): Promise<Result<void, AuthorizationError>> {
      if (denyAll || denyActions.has(action)) {
        return Promise.resolve(
          err(new AuthorizationError('FORBIDDEN', `Action '${action}' is not permitted`)),
        );
      }
      return Promise.resolve(ok(undefined));
    },

    listEffectivePermissions(
      _ctx: RequestContext,
      workspaceId: string,
    ): Promise<Result<EffectivePermissionSet, AuthorizationError>> {
      return Promise.resolve(
        ok({
          workspaceId,
          permissions: new Set<string>(),
          fromRoles: [],
          fromInstallationRoles: [],
        }),
      );
    },

    explain(
      _ctx: RequestContext,
      action: string,
      _resourceType: string,
    ): Promise<
      Result<{ decision: 'allow' | 'deny'; matchedRules: []; reason: string }, AuthorizationError>
    > {
      const allowed = !denyAll && !denyActions.has(action);
      return Promise.resolve(
        ok({ decision: allowed ? 'allow' : 'deny', matchedRules: [], reason: 'test stub' }),
      );
    },
  };
}
