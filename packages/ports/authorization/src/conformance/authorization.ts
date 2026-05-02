/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it } from 'vitest';

import type { AuthorizationPort } from '../authorization.port.js';
import type { RequestContext } from '../types.js';

function makeCtx(overrides?: Partial<RequestContext>): RequestContext {
  return {
    userId: 'user-1',
    workspaceId: 'ws-1',
    installationRoles: [],
    correlationId: 'corr-1',
    mfaSatisfied: false,
    _kind: 'user',
    ...overrides,
  };
}

/**
 * Conformance suite for AuthorizationPort implementations.
 * Pass a factory that returns a configured adapter + seed functions.
 */
export function runAuthorizationConformanceSuite(
  name: string,
  factory: () => Promise<{
    authz: AuthorizationPort;
    /** Seed: give the user `roleNames` in `workspaceId`. */
    grantRoles(userId: string, workspaceId: string, roleNames: string[]): Promise<void>;
    /** Seed: give the user installation role. */
    grantInstallationRole(userId: string, role: string): Promise<void>;
    cleanup(): Promise<void>;
  }>,
): void {
  describe(`AuthorizationPort conformance — ${name}`, () => {
    it('denies a user with no roles', async () => {
      const { authz, cleanup } = await factory();
      try {
        const ctx = makeCtx();
        const result = await authz.authorize(ctx, 'workspace.read', 'workspace');
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.kind).toBe('FORBIDDEN');
        }
      } finally {
        await cleanup();
      }
    });

    it('allows workspace_owner to perform workspace.read', async () => {
      const { authz, grantRoles, cleanup } = await factory();
      try {
        await grantRoles('user-1', 'ws-1', ['workspace_owner']);
        const ctx = makeCtx();
        const result = await authz.authorize(ctx, 'workspace.read', 'workspace');
        expect(result.isOk()).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it('denies a user from workspace A accessing workspace B', async () => {
      const { authz, grantRoles, cleanup } = await factory();
      try {
        await grantRoles('user-1', 'ws-1', ['workspace_owner']);
        const ctx = makeCtx({ workspaceId: 'ws-2' });
        const result = await authz.authorize(ctx, 'workspace.read', 'workspace');
        expect(result.isErr()).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it('allows installation_owner to perform any operation', async () => {
      const { authz, grantInstallationRole, cleanup } = await factory();
      try {
        await grantInstallationRole('user-1', 'installation_owner');
        const ctx = makeCtx({ installationRoles: ['installation_owner'] });
        const result = await authz.authorize(ctx, 'system.read', 'system');
        expect(result.isOk()).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it('requires workspaceId for workspace-scoped operations', async () => {
      const { authz, cleanup } = await factory();
      try {
        // Omit workspaceId entirely (exactOptionalPropertyTypes: can't explicitly set to undefined)
        const { workspaceId: _omit, ...baseCtx } = makeCtx();
        const ctx: RequestContext = baseCtx;
        const result = await authz.authorize(ctx, 'workspace.read', 'workspace');
        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.kind).toBe('WORKSPACE_CONTEXT_REQUIRED');
        }
      } finally {
        await cleanup();
      }
    });

    it('listEffectivePermissions returns the union of granted roles', async () => {
      const { authz, grantRoles, cleanup } = await factory();
      try {
        await grantRoles('user-1', 'ws-1', ['viewer']);
        const ctx = makeCtx();
        const result = await authz.listEffectivePermissions(ctx, 'ws-1');
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.workspaceId).toBe('ws-1');
          expect(result.value.permissions.size).toBeGreaterThan(0);
        }
      } finally {
        await cleanup();
      }
    });

    it('explain returns an allow decision for permitted action', async () => {
      const { authz, grantRoles, cleanup } = await factory();
      try {
        await grantRoles('user-1', 'ws-1', ['workspace_owner']);
        const ctx = makeCtx();
        const result = await authz.explain(ctx, 'workspace.read', 'workspace');
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.decision).toBe('allow');
        }
      } finally {
        await cleanup();
      }
    });

    it('explain returns a deny decision for forbidden action', async () => {
      const { authz, cleanup } = await factory();
      try {
        const ctx = makeCtx();
        const result = await authz.explain(ctx, 'workspace.delete', 'workspace');
        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          expect(result.value.decision).toBe('deny');
        }
      } finally {
        await cleanup();
      }
    });

    it('viewer cannot perform workspace.update', async () => {
      const { authz, grantRoles, cleanup } = await factory();
      try {
        await grantRoles('user-1', 'ws-1', ['viewer']);
        const ctx = makeCtx();
        const result = await authz.authorize(ctx, 'workspace.update', 'workspace');
        expect(result.isErr()).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it('custom role with specific permission allows that permission only', async () => {
      const { authz, grantRoles, cleanup } = await factory();
      try {
        await grantRoles('user-1', 'ws-1', ['custom_role_prd_read']);
        const ctx = makeCtx();
        const allowResult = await authz.authorize(ctx, 'prd.read', 'prd');
        expect(allowResult.isOk()).toBe(true);
        const denyResult = await authz.authorize(ctx, 'prd.write', 'prd');
        expect(denyResult.isErr()).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it('installation_admin cannot read workspace data without membership', async () => {
      const { authz, grantInstallationRole, cleanup } = await factory();
      try {
        await grantInstallationRole('user-1', 'installation_admin');
        const ctx = makeCtx({ installationRoles: ['installation_admin'] });
        const result = await authz.authorize(ctx, 'prd.read', 'prd');
        expect(result.isErr()).toBe(true);
      } finally {
        await cleanup();
      }
    });
  });
}
