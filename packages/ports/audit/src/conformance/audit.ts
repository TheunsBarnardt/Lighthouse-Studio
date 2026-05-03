import { describe, expect, it } from 'vitest';

import type { AuditEntryInput, AuditPort } from '../index.js';

function makeEntry(overrides: Partial<AuditEntryInput> = {}): AuditEntryInput {
  return {
    eventType: 'workspace.updated',
    workspaceId: 'ws-1',
    actor: { kind: 'user', id: 'user-1' },
    resource: { type: 'workspace', id: 'ws-1' },
    action: 'updated',
    outcome: 'success',
    correlationId: 'corr-1',
    ...overrides,
  };
}

export function runAuditConformance(name: string, factory: () => Promise<AuditPort>): void {
  describe(`${name} — AuditPort conformance`, () => {
    // ── write ────────────────────────────────────────────────────────────────

    it('write returns AuditEntry with id, sequence, hashes', async () => {
      const audit = await factory();
      const result = await audit.write(makeEntry());
      expect(result.isOk()).toBe(true);
      const entry = result._unsafeUnwrap();
      expect(entry.id).toBeTruthy();
      expect(typeof entry.sequence).toBe('number');
      expect(entry.hash).toHaveLength(64); // sha-256 hex
      expect(entry.prevHash).toHaveLength(64);
      expect(entry.occurredAt).toBeInstanceOf(Date);
    });

    it('write sequences increment monotonically within a workspace', async () => {
      const audit = await factory();
      const ws = `ws-seq-${String(Date.now())}`;
      const r1 = await audit.write(makeEntry({ workspaceId: ws, correlationId: 'c1' }));
      const r2 = await audit.write(makeEntry({ workspaceId: ws, correlationId: 'c2' }));
      const r3 = await audit.write(makeEntry({ workspaceId: ws, correlationId: 'c3' }));
      const seq1 = r1._unsafeUnwrap().sequence;
      const seq2 = r2._unsafeUnwrap().sequence;
      const seq3 = r3._unsafeUnwrap().sequence;
      expect(seq2).toBeGreaterThan(seq1);
      expect(seq3).toBeGreaterThan(seq2);
    });

    it('prevHash of event N equals hash of event N-1', async () => {
      const audit = await factory();
      const ws = `ws-chain-${String(Date.now())}`;
      const r1 = await audit.write(makeEntry({ workspaceId: ws, correlationId: 'c1' }));
      const r2 = await audit.write(makeEntry({ workspaceId: ws, correlationId: 'c2' }));
      expect(r2._unsafeUnwrap().prevHash).toBe(r1._unsafeUnwrap().hash);
    });

    it('sequences for different workspaces are independent', async () => {
      const audit = await factory();
      const tsStr = String(Date.now());
      const wsA = `ws-a-${tsStr}`;
      const wsB = `ws-b-${tsStr}`;
      const rA1 = await audit.write(makeEntry({ workspaceId: wsA, correlationId: 'ca1' }));
      const rB1 = await audit.write(makeEntry({ workspaceId: wsB, correlationId: 'cb1' }));
      const rA2 = await audit.write(makeEntry({ workspaceId: wsA, correlationId: 'ca2' }));
      const seqA1 = rA1._unsafeUnwrap().sequence;
      const seqB1 = rB1._unsafeUnwrap().sequence;
      const seqA2 = rA2._unsafeUnwrap().sequence;
      expect(seqA2).toBeGreaterThan(seqA1);
      // B1 should have its own independent sequence (≥ 1)
      expect(seqB1).toBeGreaterThanOrEqual(1);
    });

    // ── writeBatch ───────────────────────────────────────────────────────────

    it('writeBatch returns entries with consecutive sequences', async () => {
      const audit = await factory();
      const ws = `ws-batch-${String(Date.now())}`;
      const result = await audit.writeBatch([
        makeEntry({ workspaceId: ws, correlationId: 'b1' }),
        makeEntry({ workspaceId: ws, correlationId: 'b2' }),
        makeEntry({ workspaceId: ws, correlationId: 'b3' }),
      ]);
      expect(result.isOk()).toBe(true);
      const entries = result._unsafeUnwrap();
      expect(entries).toHaveLength(3);
      const [seq0, seq1, seq2] = entries.map((e) => e.sequence) as [number, number, number];
      expect(seq1).toBe(seq0 + 1);
      expect(seq2).toBe(seq1 + 1);
    });

    // ── query ────────────────────────────────────────────────────────────────

    it('query returns written entries', async () => {
      const audit = await factory();
      const ws = `ws-q-${String(Date.now())}`;
      await audit.write(makeEntry({ workspaceId: ws, correlationId: 'q1' }));
      const result = await audit.query({ workspaceId: ws }, { limit: 10, offset: 0 });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().items.length).toBeGreaterThanOrEqual(1);
    });

    it('query filters by eventType', async () => {
      const audit = await factory();
      const ws = `ws-et-${String(Date.now())}`;
      await audit.write(
        makeEntry({
          workspaceId: ws,
          eventType: 'workspace.created',
          action: 'created',
          correlationId: 'e1',
        }),
      );
      await audit.write(
        makeEntry({
          workspaceId: ws,
          eventType: 'workspace.updated',
          action: 'updated',
          correlationId: 'e2',
        }),
      );
      const result = await audit.query(
        { workspaceId: ws, eventType: 'workspace.created' },
        { limit: 10, offset: 0 },
      );
      expect(result.isOk()).toBe(true);
      const items = result._unsafeUnwrap().items;
      expect(items.every((e) => e.eventType === 'workspace.created')).toBe(true);
    });

    it('query filters by actorId', async () => {
      const audit = await factory();
      const ws = `ws-actor-${String(Date.now())}`;
      await audit.write(
        makeEntry({ workspaceId: ws, actor: { kind: 'user', id: 'user-A' }, correlationId: 'a1' }),
      );
      await audit.write(
        makeEntry({ workspaceId: ws, actor: { kind: 'user', id: 'user-B' }, correlationId: 'a2' }),
      );
      const result = await audit.query(
        { workspaceId: ws, actorId: 'user-A' },
        { limit: 10, offset: 0 },
      );
      expect(result.isOk()).toBe(true);
      const items = result._unsafeUnwrap().items;
      expect(items.every((e) => e.actor.id === 'user-A')).toBe(true);
    });

    it('query filters by outcome', async () => {
      const audit = await factory();
      const ws = `ws-out-${String(Date.now())}`;
      await audit.write(makeEntry({ workspaceId: ws, outcome: 'success', correlationId: 'o1' }));
      await audit.write(makeEntry({ workspaceId: ws, outcome: 'denied', correlationId: 'o2' }));
      const result = await audit.query(
        { workspaceId: ws, outcome: 'denied' },
        { limit: 10, offset: 0 },
      );
      expect(result.isOk()).toBe(true);
      const items = result._unsafeUnwrap().items;
      expect(items.every((e) => e.outcome === 'denied')).toBe(true);
    });

    it('query filters by time range', async () => {
      const audit = await factory();
      const ws = `ws-time-${String(Date.now())}`;
      const past = new Date(Date.now() - 10_000);
      const future = new Date(Date.now() + 10_000);
      await audit.write(makeEntry({ workspaceId: ws, correlationId: 't1' }));
      const result = await audit.query(
        { workspaceId: ws, occurredAfter: past, occurredBefore: future },
        { limit: 10, offset: 0 },
      );
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().items.length).toBeGreaterThanOrEqual(1);
    });

    it('query pagination returns non-overlapping pages', async () => {
      const audit = await factory();
      const ws = `ws-page-${String(Date.now())}`;
      for (let i = 0; i < 5; i++) {
        await audit.write(makeEntry({ workspaceId: ws, correlationId: `p${String(i)}` }));
      }
      const page1 = await audit.query({ workspaceId: ws }, { limit: 2, offset: 0 });
      const page2 = await audit.query({ workspaceId: ws }, { limit: 2, offset: 2 });
      const ids1 = page1._unsafeUnwrap().items.map((e) => e.id);
      const ids2 = page2._unsafeUnwrap().items.map((e) => e.id);
      expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });

    // ── verifyChain ──────────────────────────────────────────────────────────

    it('verifyChain reports intact for a freshly written chain', async () => {
      const audit = await factory();
      const ws = `ws-verify-${String(Date.now())}`;
      for (let i = 0; i < 5; i++) {
        await audit.write(makeEntry({ workspaceId: ws, correlationId: `v${String(i)}` }));
      }
      const result = await audit.verifyChain(ws);
      expect(result.isOk()).toBe(true);
      const verification = result._unsafeUnwrap();
      expect(verification.status).toBe('intact');
      expect(verification.eventsVerified).toBe(5);
    });

    it('verifyChain on empty workspace returns intact with 0 events', async () => {
      const audit = await factory();
      const ws = `ws-empty-${String(Date.now())}`;
      const result = await audit.verifyChain(ws);
      expect(result.isOk()).toBe(true);
      const verification = result._unsafeUnwrap();
      expect(verification.status).toBe('intact');
      expect(verification.eventsVerified).toBe(0);
    });
  });
}
