import type {
  AuthorizationPort,
  AuthorizationExplanation,
  EffectivePermissionSet,
  RequestContext,
  ResourceContext,
  RolePermission,
  WorkspaceMemberRole,
  WorkspaceRole,
} from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { AuthorizationError } from '@platform/ports-authorization';
import { err, ok, type Result } from 'neverthrow';

import { checkPermission, resolveEffectivePermissions } from './permission-evaluator.js';

// ── Workspace-scoped operations that always need a workspaceId ─────────────────
// If an action targets a workspace resource but no workspaceId is in the context,
// we return WORKSPACE_CONTEXT_REQUIRED instead of FORBIDDEN.

const WORKSPACE_SCOPED_RESOURCES = new Set([
  'workspace',
  'member',
  'role',
  'invitation',
  'intent_brief',
  'prd',
  'brd',
  'design_tokens',
  'prototype',
  'schema',
  'ui',
  'code',
  'test',
  'deploy',
  'artifact',
  'approval',
  'data_table',
  'data_row',
]);

// ── Per-request cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  permissions: Set<string>;
  fromRoles: string[];
}

// WeakMap keyed by the RequestContext object — automatically GC'd when request ends.
const requestCache = new WeakMap<RequestContext, Map<string, CacheEntry>>();

function getCacheForRequest(ctx: RequestContext): Map<string, CacheEntry> {
  let cache = requestCache.get(ctx);
  if (!cache) {
    cache = new Map();
    requestCache.set(ctx, cache);
  }
  return cache;
}

// ── Repository types used by the adapter ──────────────────────────────────────

type MemberRoleRepo = RepositoryPort<WorkspaceMemberRole>;
type RoleRepo = RepositoryPort<WorkspaceRole>;
type RolePermRepo = RepositoryPort<RolePermission>;

interface MemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  status: string;
}
type MemberRepo = RepositoryPort<MemberRecord>;

// ── Adapter ───────────────────────────────────────────────────────────────────

export class BuiltInAuthorizationAdapter implements AuthorizationPort {
  constructor(
    private readonly members: MemberRepo,
    private readonly memberRoles: MemberRoleRepo,
    private readonly roles: RoleRepo,
    private readonly rolePermissions: RolePermRepo,
    private readonly logger: LoggerPort,
  ) {}

  async authorize(
    ctx: RequestContext,
    action: string,
    resourceType: string,
    _resourceContext?: ResourceContext,
  ): Promise<Result<void, AuthorizationError>> {
    // ── installation_owner bypasses everything ────────────────────────────────
    if (ctx.installationRoles.includes('installation_owner')) {
      this.logger.debug('Authorization granted (installation_owner)', {
        userId: ctx.userId,
        action,
        resourceType,
        correlationId: ctx.correlationId,
      });
      return ok(undefined);
    }

    const isWorkspaceResource = WORKSPACE_SCOPED_RESOURCES.has(resourceType);

    // ── Workspace context check ───────────────────────────────────────────────
    if (isWorkspaceResource && !ctx.workspaceId) {
      this.logger.info('Authorization denied — workspace context required', {
        userId: ctx.userId,
        action,
        resourceType,
        correlationId: ctx.correlationId,
      });
      return err(
        new AuthorizationError(
          'WORKSPACE_CONTEXT_REQUIRED',
          `Action '${action}' on '${resourceType}' requires a workspace context`,
        ),
      );
    }

    // ── Load effective permissions (cached per request) ───────────────────────
    const permResult = await this._loadPermissions(ctx);
    if (permResult.isErr()) return err(permResult.error);

    const { permissions, fromRoles } = permResult.value;

    // ── Check permission ──────────────────────────────────────────────────────
    if (checkPermission(permissions, action, resourceType)) {
      this.logger.debug('Authorization granted', {
        userId: ctx.userId,
        action,
        resourceType,
        fromRoles,
        correlationId: ctx.correlationId,
      });
      return ok(undefined);
    }

    // ── Deny — log at info ────────────────────────────────────────────────────
    this.logger.info('Authorization denied', {
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      action,
      resourceType,
      correlationId: ctx.correlationId,
    });

    return err(
      new AuthorizationError(
        'FORBIDDEN',
        `User does not have permission to perform '${action}' on '${resourceType}'`,
      ),
    );
  }

  async listEffectivePermissions(
    ctx: RequestContext,
    workspaceId: string,
  ): Promise<Result<EffectivePermissionSet, AuthorizationError>> {
    if (!ctx.workspaceId || ctx.workspaceId !== workspaceId) {
      return err(
        new AuthorizationError(
          'WORKSPACE_CONTEXT_REQUIRED',
          'listEffectivePermissions requires matching workspaceId in context',
        ),
      );
    }

    const permResult = await this._loadPermissions(ctx);
    if (permResult.isErr()) return err(permResult.error);

    return ok({
      workspaceId,
      permissions: permResult.value.permissions,
      fromRoles: permResult.value.fromRoles,
      fromInstallationRoles: [...ctx.installationRoles],
    });
  }

  async explain(
    ctx: RequestContext,
    action: string,
    resourceType: string,
  ): Promise<Result<AuthorizationExplanation, AuthorizationError>> {
    const permResult = await this._loadPermissions(ctx);
    if (permResult.isErr()) return err(permResult.error);

    const { permissions, fromRoles } = permResult.value;
    const granted = checkPermission(permissions, action, resourceType);

    const matchedRules: AuthorizationExplanation['matchedRules'] = fromRoles.map((role) => ({
      ruleType: 'role_grant' as const,
      details: `role '${role}' grants permissions`,
    }));

    if (ctx.installationRoles.length > 0) {
      for (const ir of ctx.installationRoles) {
        matchedRules.push({
          ruleType: 'installation_role',
          details: `installation role '${ir}'`,
        });
      }
    }

    return ok({
      decision: granted ? 'allow' : 'deny',
      matchedRules,
      reason: granted
        ? `Permission '${action}:${resourceType}' is granted via roles: ${fromRoles.join(', ') || '(none)'}`
        : `No role grants '${action}' on '${resourceType}'. Effective roles: ${fromRoles.join(', ') || '(none)'}`,
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async _loadPermissions(
    ctx: RequestContext,
  ): Promise<Result<CacheEntry, AuthorizationError>> {
    const cacheKey = ctx.workspaceId ?? '__no_workspace__';
    const cache = getCacheForRequest(ctx);
    const cached = cache.get(cacheKey);
    if (cached) return ok(cached);

    try {
      if (!ctx.workspaceId) {
        // No workspace — only installation-level roles contribute
        const entry: CacheEntry = { permissions: new Set(), fromRoles: [] };
        cache.set(cacheKey, entry);
        return ok(entry);
      }

      // 1. Find active member record
      const memberResult = await this.members.findOne({
        _and: [
          { workspaceId: { _eq: ctx.workspaceId } },
          { userId: { _eq: ctx.userId } },
          { status: { _eq: 'active' } },
        ],
      } as Parameters<MemberRepo['findOne']>[0]);

      if (memberResult.isErr()) {
        return err(new AuthorizationError('UNKNOWN', 'Failed to load member record'));
      }

      if (!memberResult.value) {
        // Not a member — no permissions
        const entry: CacheEntry = { permissions: new Set(), fromRoles: [] };
        cache.set(cacheKey, entry);
        return ok(entry);
      }

      const memberId = memberResult.value.id;

      // 2. Load role assignments for the member
      const memberRolesResult = await this.memberRoles.findMany({
        filter: { workspaceMemberId: { _eq: memberId } } as Parameters<
          MemberRoleRepo['findMany']
        >[0] extends { filter?: infer F }
          ? F
          : never,
      });
      if (memberRolesResult.isErr()) {
        return err(new AuthorizationError('UNKNOWN', 'Failed to load member roles'));
      }

      const directRoleIds = memberRolesResult.value.items
        .filter((mr) => !mr.archivedAt)
        .map((mr) => mr.roleId);

      // 3. Load all roles (built-in + custom for this workspace)
      const rolesResult = await this.roles.findMany({
        filter: {
          _or: [{ workspaceId: { _eq: ctx.workspaceId } }, { builtin: { _eq: true } }],
        } as Parameters<RoleRepo['findMany']>[0] extends { filter?: infer F } ? F : never,
        page: { limit: 500, offset: 0 },
        includeArchived: false,
      });
      if (rolesResult.isErr()) {
        return err(new AuthorizationError('UNKNOWN', 'Failed to load roles'));
      }

      // 4. Load permissions for all relevant roles
      const allRoles = rolesResult.value.items;
      const allRoleIds = allRoles.map((r) => r.id);

      const rolePermsResult = await this.rolePermissions.findMany({
        filter: { roleId: { _in: allRoleIds } } as Parameters<RolePermRepo['findMany']>[0] extends {
          filter?: infer F;
        }
          ? F
          : never,
        page: { limit: 5000, offset: 0 },
        includeArchived: false,
      });
      if (rolePermsResult.isErr()) {
        return err(new AuthorizationError('UNKNOWN', 'Failed to load role permissions'));
      }

      // 5. Resolve effective permissions via hierarchy
      const resolved = resolveEffectivePermissions(
        directRoleIds,
        allRoles,
        rolePermsResult.value.items,
      );

      const entry: CacheEntry = {
        permissions: resolved.permissions,
        fromRoles: resolved.fromRoles,
      };
      cache.set(cacheKey, entry);
      return ok(entry);
    } catch (e) {
      return err(new AuthorizationError('UNKNOWN', `Permission load failed: ${String(e)}`, e));
    }
  }
}
