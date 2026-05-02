import { describe, expect, it } from 'vitest';

import type { AuditPort } from '../audit.port.js';

export function runAuditConformance(name: string, factory: () => Promise<AuditPort>): void {
  describe(`${name} — AuditPort conformance`, () => {
    it('write returns ok', async () => {
      const audit = await factory();
      const result = await audit.write({
        workspaceId: 'ws-1',
        actorId: 'user-1',
        action: 'resource.created',
        resourceType: 'project',
        resourceId: 'proj-1',
        occurredAt: new Date(),
      });
      expect(result.isOk()).toBe(true);
    });

    it('query returns written entries', async () => {
      const audit = await factory();
      const wsId = `ws-${String(Date.now())}`;
      await audit.write({
        workspaceId: wsId,
        actorId: 'user-1',
        action: 'test.action',
        resourceType: 'test',
        resourceId: 'res-1',
        occurredAt: new Date(),
      });
      const result = await audit.query({ workspaceId: wsId }, { limit: 10, offset: 0 });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().items.length).toBeGreaterThanOrEqual(1);
    });

    it('query with action filter narrows results', async () => {
      const audit = await factory();
      const wsId = `ws-filter-${String(Date.now())}`;
      await audit.write({
        workspaceId: wsId,
        actorId: null,
        action: 'a.created',
        resourceType: 'x',
        resourceId: 'r1',
        occurredAt: new Date(),
      });
      await audit.write({
        workspaceId: wsId,
        actorId: null,
        action: 'b.deleted',
        resourceType: 'x',
        resourceId: 'r2',
        occurredAt: new Date(),
      });
      const result = await audit.query(
        { workspaceId: wsId, action: 'a.created' },
        { limit: 10, offset: 0 },
      );
      expect(result.isOk()).toBe(true);
      const items = result._unsafeUnwrap().items;
      expect(items.every((e) => e.action === 'a.created')).toBe(true);
    });

    it('query pagination works', async () => {
      const audit = await factory();
      const wsId = `ws-page-${String(Date.now())}`;
      for (let i = 0; i < 5; i++) {
        await audit.write({
          workspaceId: wsId,
          actorId: null,
          action: 'page.test',
          resourceType: 'x',
          resourceId: `r${String(i)}`,
          occurredAt: new Date(),
        });
      }
      const page1 = await audit.query({ workspaceId: wsId }, { limit: 2, offset: 0 });
      const page2 = await audit.query({ workspaceId: wsId }, { limit: 2, offset: 2 });
      expect(page1._unsafeUnwrap().items.length).toBe(2);
      expect(page2._unsafeUnwrap().items.length).toBe(2);
      const ids1 = page1._unsafeUnwrap().items.map((e) => e.resourceId);
      const ids2 = page2._unsafeUnwrap().items.map((e) => e.resourceId);
      expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });
  });
}
