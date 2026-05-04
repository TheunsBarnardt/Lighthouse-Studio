import { describe, it, expect, vi } from 'vitest';

import { createInMemoryAuthz, makeUserContext } from '../../../testing/index.js';
import { PermissionCache } from './permission-cache.js';

const ctx = makeUserContext({ workspaceId: 'ws-1' });

describe('PermissionCache', () => {
  it('allows when authz allows', async () => {
    const authz = createInMemoryAuthz();
    const cache = new PermissionCache(authz);
    const result = await cache.check(ctx, 'data_table.read', 'table', 'tbl-1');
    expect(result).toBe(true);
  });

  it('denies when authz denies', async () => {
    const authz = createInMemoryAuthz({ deny: true });
    const cache = new PermissionCache(authz);
    const result = await cache.check(ctx, 'data_table.read', 'table', 'tbl-1');
    expect(result).toBe(false);
  });

  it('caches the result and does not call authz twice for same key', async () => {
    const authz = createInMemoryAuthz();
    const spy = vi.spyOn(authz, 'authorize');
    const cache = new PermissionCache(authz, 60_000);

    await cache.check(ctx, 'data_table.read', 'table', 'tbl-1');
    await cache.check(ctx, 'data_table.read', 'table', 'tbl-1');

    expect(spy).toHaveBeenCalledOnce();
  });

  it('calls authz again after cache is invalidated', async () => {
    const authz = createInMemoryAuthz();
    const spy = vi.spyOn(authz, 'authorize');
    const cache = new PermissionCache(authz, 60_000);

    await cache.check(ctx, 'data_table.read', 'table', 'tbl-1');
    cache.invalidate();
    await cache.check(ctx, 'data_table.read', 'table', 'tbl-1');

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('treats different keys as independent cache entries', async () => {
    const authz = createInMemoryAuthz({ denyActions: ['pii.read.contact'] });
    const cache = new PermissionCache(authz);

    const tableOk = await cache.check(ctx, 'data_table.read', 'table', 'tbl-1');
    const piiDenied = await cache.check(ctx, 'pii.read.contact', 'pii_column', 'col-1');

    expect(tableOk).toBe(true);
    expect(piiDenied).toBe(false);
  });
});
