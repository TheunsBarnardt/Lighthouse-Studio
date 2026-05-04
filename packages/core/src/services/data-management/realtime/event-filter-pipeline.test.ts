import type { ChangeEvent } from '@platform/ports-eventing';

import { describe, it, expect } from 'vitest';

import type { CustomerTableDefinition } from '../schema-model.js';
import type { ActiveSubscription } from './types.js';

import { createInMemoryAuthz, makeUserContext } from '../../../testing/index.js';
import { evaluateFilter, EventFilterPipelineImpl } from './event-filter-pipeline.js';
import { PermissionCache } from './permission-cache.js';

// ── evaluateFilter unit tests ──────────────────────────────────────────────────

describe('evaluateFilter', () => {
  it('returns true for undefined filter', () => {
    expect(evaluateFilter(undefined, { active: true })).toBe(true);
  });

  it('matches simple equality', () => {
    expect(evaluateFilter({ active: { _eq: true } }, { active: true })).toBe(true);
    expect(evaluateFilter({ active: { _eq: true } }, { active: false })).toBe(false);
  });

  it('matches _in operator', () => {
    expect(evaluateFilter({ status: { _in: ['active', 'pending'] } }, { status: 'active' })).toBe(
      true,
    );
    expect(evaluateFilter({ status: { _in: ['active', 'pending'] } }, { status: 'archived' })).toBe(
      false,
    );
  });

  it('matches _not operator', () => {
    expect(evaluateFilter({ _not: { active: { _eq: true } } }, { active: false })).toBe(true);
    expect(evaluateFilter({ _not: { active: { _eq: true } } }, { active: true })).toBe(false);
  });

  it('matches _and operator', () => {
    const filter = { _and: [{ active: { _eq: true } }, { role: { _eq: 'admin' } }] };
    expect(evaluateFilter(filter, { active: true, role: 'admin' })).toBe(true);
    expect(evaluateFilter(filter, { active: true, role: 'viewer' })).toBe(false);
  });

  it('matches _or operator', () => {
    const filter = { _or: [{ active: { _eq: true } }, { role: { _eq: 'admin' } }] };
    expect(evaluateFilter(filter, { active: false, role: 'admin' })).toBe(true);
    expect(evaluateFilter(filter, { active: false, role: 'viewer' })).toBe(false);
  });

  it('matches _contains on strings', () => {
    expect(evaluateFilter({ name: { _contains: 'foo' } }, { name: 'foobar' })).toBe(true);
    expect(evaluateFilter({ name: { _contains: 'baz' } }, { name: 'foobar' })).toBe(false);
  });

  it('matches _is_null', () => {
    expect(evaluateFilter({ email: { _is_null: true } }, { email: null })).toBe(true);
    expect(evaluateFilter({ email: { _is_null: false } }, { email: 'a@b.c' })).toBe(true);
    expect(evaluateFilter({ email: { _is_null: true } }, { email: 'a@b.c' })).toBe(false);
  });
});

// ── EventFilterPipeline unit tests ────────────────────────────────────────────

function makeTableDef(piiColumns: string[] = []): CustomerTableDefinition {
  return {
    id: 'tbl-users',
    name: 'users',
    columns: [
      { id: 'col-id', name: 'id', type: { kind: 'uuid' }, nullable: false },
      { id: 'col-active', name: 'active', type: { kind: 'boolean' }, nullable: false },
      ...piiColumns.map((name, i) => ({
        id: `col-${name}-${String(i)}`,
        name,
        type: { kind: 'string' as const },
        nullable: true,
        isPii: true,
        piiCategory: 'contact' as const,
      })),
    ],
    primaryKey: { kind: 'single' as const, columnId: 'col-id' },
    indexes: [],
    foreignKeys: [],
    constraints: [],
  };
}

function makeSub(overrides: Partial<ActiveSubscription> = {}): ActiveSubscription {
  return {
    id: 'sub-1',
    connectionId: 'conn-1',
    workspaceId: 'ws-1',
    schemaId: 'schema-1',
    tableId: 'users',
    tableDef: makeTableDef(),
    mode: 'stream',
    buffer: [],
    totalDropped: 0,
    createdAt: new Date(),
    cancel: () => {},
    ...overrides,
  };
}

function makeChangeEvent(overrides: Partial<ChangeEvent> = {}): ChangeEvent {
  return {
    table: 'users',
    operation: 'insert',
    after: { id: 'u-1', active: true },
    occurredAt: new Date(),
    position: 'pos-1',
    ...overrides,
  };
}

const ctx = makeUserContext({ workspaceId: 'ws-1' });

describe('EventFilterPipeline.process', () => {
  it('delivers a matching insert event', async () => {
    const pipeline = new EventFilterPipelineImpl();
    const authz = createInMemoryAuthz();
    const permCache = new PermissionCache(authz);

    const result = await pipeline.process(makeChangeEvent(), makeSub(), ctx, permCache);
    expect(result).not.toBeNull();
    expect(result?.operation).toBe('insert');
  });

  it('drops event when operation filter excludes it', async () => {
    const pipeline = new EventFilterPipelineImpl();
    const authz = createInMemoryAuthz();
    const permCache = new PermissionCache(authz);

    const sub = makeSub({ operations: ['update', 'delete'] });
    const event = makeChangeEvent({ operation: 'insert' });

    const result = await pipeline.process(event, sub, ctx, permCache);
    expect(result).toBeNull();
  });

  it('drops event when filter AST does not match', async () => {
    const pipeline = new EventFilterPipelineImpl();
    const authz = createInMemoryAuthz();
    const permCache = new PermissionCache(authz);

    const sub = makeSub({ filter: { active: { _eq: false } } });
    const event = makeChangeEvent({ after: { id: 'u-1', active: true } });

    const result = await pipeline.process(event, sub, ctx, permCache);
    expect(result).toBeNull();
  });

  it('drops event when principal lacks table read permission', async () => {
    const pipeline = new EventFilterPipelineImpl();
    const authz = createInMemoryAuthz({ denyActions: ['data_table.read'] });
    const permCache = new PermissionCache(authz);

    const result = await pipeline.process(makeChangeEvent(), makeSub(), ctx, permCache);
    expect(result).toBeNull();
  });

  it('redacts PII columns the subscriber cannot read', async () => {
    const pipeline = new EventFilterPipelineImpl();
    const authz = createInMemoryAuthz({ denyActions: ['pii.read.contact'] });
    const permCache = new PermissionCache(authz);

    const tableDef = makeTableDef(['email', 'phone']);
    const sub = makeSub({ tableDef });
    const event = makeChangeEvent({
      after: { id: 'u-1', active: true, email: 'test@example.com', phone: '+1234567890' },
    });

    const result = await pipeline.process(event, sub, ctx, permCache);
    expect(result).not.toBeNull();
    expect(result?.after?.['email']).toBeNull();
    expect(result?.after?.['phone']).toBeNull();
    expect(result?.redacted).toContain('email');
    expect(result?.redacted).toContain('phone');
  });

  it('projects only requested fields', async () => {
    const pipeline = new EventFilterPipelineImpl();
    const authz = createInMemoryAuthz();
    const permCache = new PermissionCache(authz);

    const sub = makeSub({ fields: ['id'] });
    const event = makeChangeEvent({ after: { id: 'u-1', active: true } });

    const result = await pipeline.process(event, sub, ctx, permCache);
    expect(result?.after).toEqual({ id: 'u-1' });
    expect(result?.after).not.toHaveProperty('active');
  });
});
