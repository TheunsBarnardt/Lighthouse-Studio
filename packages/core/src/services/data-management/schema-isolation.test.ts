// Cross-workspace isolation tests for the schema service.
// These tests verify that workspace A's operations cannot read or affect workspace B's data.

import { describe, it, expect } from 'vitest';

import type { CustomerSchema, SchemaVersion } from './schema-model.js';

import { ApprovalRoutingEngine } from '../../approvals/approval-routing.engine.js';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryDdl,
  createInMemoryIntrospection,
  createInMemoryLogger,
  createInMemoryMigration,
  createInMemoryRepo,
  makeUserContext,
} from '../../testing/index.js';
import { SchemaService } from './schema.service.js';

function makeSharedService() {
  // One service instance; one set of repos — simulates a single platform installation
  const schemas = createInMemoryRepo<CustomerSchema>();
  const schemaVersions = createInMemoryRepo<SchemaVersion>();
  const service = new SchemaService(
    createInMemoryAuthz(),
    schemas,
    schemaVersions,
    createInMemoryIntrospection(),
    createInMemoryDdl(),
    createInMemoryMigration(),
    createInMemoryAudit(),
    createInMemoryLogger(),
    new ApprovalRoutingEngine(),
  );
  return { service, schemas, schemaVersions };
}

function ctxA(userId = 'user-a') {
  return makeUserContext({ userId, workspaceId: 'workspace-a' });
}

function ctxB(userId = 'user-b') {
  return makeUserContext({ userId, workspaceId: 'workspace-b' });
}

describe('Cross-workspace schema isolation', () => {
  it('workspace A cannot read workspace B schema by ID', async () => {
    const { service } = makeSharedService();

    // B creates a schema
    const schemaB = (
      await service.createSchema(ctxB(), {
        name: 'B Schema',
        slug: 'b_schema',
        databaseDriver: 'postgres',
      })
    )._unsafeUnwrap();

    // A tries to read B's schema by ID
    const result = await service.getSchema(ctxA(), schemaB.id);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('listSchemas for workspace A returns only A schemas', async () => {
    const { service } = makeSharedService();

    await service.createSchema(ctxA(), { name: 'A1', slug: 'a1', databaseDriver: 'postgres' });
    await service.createSchema(ctxA(), { name: 'A2', slug: 'a2', databaseDriver: 'postgres' });
    await service.createSchema(ctxB(), { name: 'B1', slug: 'b1', databaseDriver: 'postgres' });

    const resultA = await service.listSchemas(ctxA());
    const resultB = await service.listSchemas(ctxB());

    expect(resultA.isOk()).toBe(true);
    expect(resultA._unsafeUnwrap().items).toHaveLength(2);
    expect(resultA._unsafeUnwrap().items.every((s) => s.workspaceId === 'workspace-a')).toBe(true);

    expect(resultB.isOk()).toBe(true);
    expect(resultB._unsafeUnwrap().items).toHaveLength(1);
    expect(resultB._unsafeUnwrap().items[0]?.workspaceId).toBe('workspace-b');
  });

  it('workspace A cannot update workspace B schema', async () => {
    const { service } = makeSharedService();

    const schemaB = (
      await service.createSchema(ctxB(), {
        name: 'B Schema',
        slug: 'b_schema',
        databaseDriver: 'postgres',
      })
    )._unsafeUnwrap();

    const result = await service.updateSchema(ctxA(), {
      schemaId: schemaB.id,
      expectedVersion: 1,
      changes: { name: 'Hijacked' },
    });

    // Should fail — ctxA cannot find schemaB (returns NOT_FOUND, not exposing existence)
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');

    // Schema B is unchanged
    const fetched = await service.getSchema(ctxB(), schemaB.id);
    expect(fetched._unsafeUnwrap().name).toBe('B Schema');
  });

  it('workspace A cannot delete workspace B schema', async () => {
    const { service } = makeSharedService();

    const schemaB = (
      await service.createSchema(ctxB(), {
        name: 'B Schema',
        slug: 'b_schema',
        databaseDriver: 'postgres',
      })
    )._unsafeUnwrap();

    const result = await service.deleteSchema(ctxA(), {
      schemaId: schemaB.id,
      expectedVersion: 1,
      dropCustomerTables: false,
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');

    // B's schema still exists
    const fetched = await service.getSchema(ctxB(), schemaB.id);
    expect(fetched.isOk()).toBe(true);
  });

  it('workspace A cannot apply changes to workspace B schema', async () => {
    const { service } = makeSharedService();

    const schemaB = (
      await service.createSchema(ctxB(), {
        name: 'B Schema',
        slug: 'b_schema',
        databaseDriver: 'postgres',
      })
    )._unsafeUnwrap();

    const result = await service.applyChanges(ctxA(), schemaB.id, { tables: [] }, 1);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('workspace A cannot export workspace B schema', async () => {
    const { service } = makeSharedService();

    const schemaB = (
      await service.createSchema(ctxB(), {
        name: 'B Schema',
        slug: 'b_schema',
        databaseDriver: 'postgres',
      })
    )._unsafeUnwrap();

    const result = await service.exportSchema(ctxA(), schemaB.id, 'json');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('workspace A can use the same slug as workspace B (slugs are workspace-scoped)', async () => {
    const { service } = makeSharedService();

    const rA = await service.createSchema(ctxA(), {
      name: 'Main',
      slug: 'main',
      databaseDriver: 'postgres',
    });
    const rB = await service.createSchema(ctxB(), {
      name: 'Main',
      slug: 'main',
      databaseDriver: 'postgres',
    });

    expect(rA.isOk()).toBe(true);
    expect(rB.isOk()).toBe(true);
    expect(rA._unsafeUnwrap().id).not.toBe(rB._unsafeUnwrap().id);
  });
});
