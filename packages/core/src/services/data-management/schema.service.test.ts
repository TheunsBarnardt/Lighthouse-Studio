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

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAdapters(opts?: { denyAll?: boolean; denyActions?: string[] }) {
  const authzOpts: Parameters<typeof createInMemoryAuthz>[0] = {};
  if (opts?.denyAll) authzOpts['deny'] = opts.denyAll;
  if (opts?.denyActions) authzOpts['denyActions'] = opts.denyActions;
  return {
    authz: createInMemoryAuthz(authzOpts),
    schemas: createInMemoryRepo<CustomerSchema>(),
    schemaVersions: createInMemoryRepo<SchemaVersion>(),
    introspection: createInMemoryIntrospection(),
    ddl: createInMemoryDdl(),
    migration: createInMemoryMigration(),
    audit: createInMemoryAudit(),
    logger: createInMemoryLogger(),
    approvals: new ApprovalRoutingEngine(),
  };
}

function makeService(opts?: { denyAll?: boolean; denyActions?: string[] }) {
  const adapters = makeAdapters(opts);
  const service = new SchemaService(
    adapters.authz,
    adapters.schemas,
    adapters.schemaVersions,
    adapters.introspection,
    adapters.ddl,
    adapters.migration,
    adapters.audit,
    adapters.logger,
    adapters.approvals,
  );
  return { service, adapters };
}

function makeCtx(workspaceId = 'ws-1') {
  return makeUserContext({ userId: 'user-1', workspaceId });
}

// ── createSchema ───────────────────────────────────────────────────────────────

describe('SchemaService.createSchema', () => {
  it('creates a schema with valid input', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const result = await service.createSchema(ctx, {
      name: 'Main Schema',
      slug: 'main_schema',
      databaseDriver: 'postgres',
    });

    expect(result.isOk()).toBe(true);
    const schema = result._unsafeUnwrap();
    expect(schema.name).toBe('Main Schema');
    expect(schema.slug).toBe('main_schema');
    expect(schema.databaseDriver).toBe('postgres');
    expect(schema.version).toBe(1);
    expect(schema.workspaceId).toBe('ws-1');
    expect(schema.tables).toEqual([]);
  });

  it('persists the schema in the repo', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'mssql' });

    expect(adapters.schemas.store.size).toBe(1);
  });

  it('emits a schema.created audit event on success', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' });

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: 'data_management.schema.created',
        outcome: 'success',
      }),
    );
  });

  it('returns VALIDATION error for empty name', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const result = await service.createSchema(ctx, {
      name: '',
      slug: 'test',
      databaseDriver: 'postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns VALIDATION error for invalid slug characters', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const result = await service.createSchema(ctx, {
      name: 'Test',
      slug: 'my-schema', // hyphens not allowed; only underscores
      databaseDriver: 'postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('returns CONFLICT for duplicate slug within workspace', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    await service.createSchema(ctx, { name: 'First', slug: 'main', databaseDriver: 'postgres' });
    const second = await service.createSchema(ctx, {
      name: 'Second',
      slug: 'main',
      databaseDriver: 'postgres',
    });

    expect(second.isErr()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('returns FORBIDDEN when authorization is denied', async () => {
    const { service, adapters } = makeService({ denyAll: true });
    const ctx = makeCtx();

    const result = await service.createSchema(ctx, {
      name: 'Test',
      slug: 'test',
      databaseDriver: 'postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
    expect(adapters.audit.events).toContainEqual(expect.objectContaining({ outcome: 'denied' }));
  });

  it('requires workspace context', async () => {
    const { service } = makeService();
    const ctx = makeUserContext({ userId: 'user-1' }); // no workspaceId

    const result = await service.createSchema(ctx, {
      name: 'Test',
      slug: 'test',
      databaseDriver: 'postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('WORKSPACE_CONTEXT_REQUIRED');
  });

  it('allows same slug in different workspaces', async () => {
    const { service } = makeService();

    const ctx1 = makeCtx('workspace-1');
    const ctx2 = makeCtx('workspace-2');

    const r1 = await service.createSchema(ctx1, {
      name: 'Test',
      slug: 'main',
      databaseDriver: 'postgres',
    });
    const r2 = await service.createSchema(ctx2, {
      name: 'Test',
      slug: 'main',
      databaseDriver: 'postgres',
    });

    expect(r1.isOk()).toBe(true);
    expect(r2.isOk()).toBe(true);
  });
});

// ── getSchema ──────────────────────────────────────────────────────────────────

describe('SchemaService.getSchema', () => {
  it('returns a schema that exists in the workspace', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const created = (
      await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();
    const fetched = await service.getSchema(ctx, created.id);

    expect(fetched.isOk()).toBe(true);
    expect(fetched._unsafeUnwrap().id).toBe(created.id);
  });

  it('returns NOT_FOUND for a non-existent schema', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const result = await service.getSchema(ctx, 'non-existent-id');

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns NOT_FOUND when schema belongs to a different workspace', async () => {
    const { service } = makeService();

    const ctx1 = makeCtx('ws-1');
    const ctx2 = makeCtx('ws-2');

    const created = (
      await service.createSchema(ctx1, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const result = await service.getSchema(ctx2, created.id);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });
});

// ── listSchemas ────────────────────────────────────────────────────────────────

describe('SchemaService.listSchemas', () => {
  it('returns schemas for the workspace', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    await service.createSchema(ctx, { name: 'First', slug: 'first', databaseDriver: 'postgres' });
    await service.createSchema(ctx, { name: 'Second', slug: 'second', databaseDriver: 'mssql' });

    const result = await service.listSchemas(ctx);

    expect(result.isOk()).toBe(true);
    const { items } = result._unsafeUnwrap();
    expect(items).toHaveLength(2);
  });

  it('does not return schemas from other workspaces', async () => {
    const { service } = makeService();

    const ctx1 = makeCtx('ws-1');
    const ctx2 = makeCtx('ws-2');

    await service.createSchema(ctx1, { name: 'Test', slug: 'test', databaseDriver: 'postgres' });

    const result = await service.listSchemas(ctx2);

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().items).toHaveLength(0);
  });
});

// ── applyChanges ───────────────────────────────────────────────────────────────

describe('SchemaService.applyChanges', () => {
  it('applies valid schema changes and creates a version record', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Blog', slug: 'blog', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const table = {
      id: 'table-1',
      name: 'posts',
      columns: [
        { id: 'col-1', name: 'id', type: { kind: 'uuid' as const }, nullable: false },
        {
          id: 'col-2',
          name: 'title',
          type: { kind: 'string' as const, length: 255 },
          nullable: false,
        },
      ],
      indexes: [],
      foreignKeys: [],
      constraints: [],
      primaryKey: { kind: 'single' as const, columnId: 'col-1' },
    };

    const result = await service.applyChanges(ctx, schema.id, { tables: [table] }, 1);

    expect(result.isOk()).toBe(true);
    const migration = result._unsafeUnwrap();
    expect(migration.outcome).toBe('succeeded');
    expect(migration.newVersion).toBe(2);

    // Version record should exist
    expect(adapters.schemaVersions.store.size).toBe(1);
  });

  it('emits a schema.deployed audit event', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();
    await service.applyChanges(ctx, schema.id, { tables: [] }, 1);

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({
        eventType: 'data_management.schema.deployed',
        outcome: 'success',
      }),
    );
  });

  it('returns CONFLICT when expected version does not match', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const result = await service.applyChanges(ctx, schema.id, { tables: [] }, 999);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('returns FORBIDDEN when authorization is denied', async () => {
    const { service } = makeService({ denyActions: ['schema.deploy'] });
    const ctx = makeCtx();

    // Create succeeds (uses schema.create)
    const makeService2 = makeService();
    const schema = (
      await makeService2.service.createSchema(ctx, {
        name: 'Test',
        slug: 'test',
        databaseDriver: 'postgres',
      })
    )._unsafeUnwrap();

    const result = await service.applyChanges(ctx, schema.id, { tables: [] }, 1);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── validateSchema ─────────────────────────────────────────────────────────────

describe('SchemaService.validateSchema', () => {
  it('returns a valid report for a clean schema', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const result = await service.validateSchema(ctx, schema.id, {
      tables: [
        {
          id: 'tbl-1',
          name: 'users',
          columns: [{ id: 'col-1', name: 'id', type: { kind: 'uuid' as const }, nullable: false }],
          indexes: [],
          foreignKeys: [],
          constraints: [],
          primaryKey: { kind: 'single' as const, columnId: 'col-1' },
        },
      ],
    });

    expect(result.isOk()).toBe(true);
    const report = result._unsafeUnwrap();
    expect(report.valid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('returns errors for invalid table names', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const result = await service.validateSchema(ctx, schema.id, {
      tables: [
        {
          id: 'tbl-1',
          name: 'MyTable', // not snake_case
          columns: [{ id: 'col-1', name: 'id', type: { kind: 'uuid' as const }, nullable: false }],
          indexes: [],
          foreignKeys: [],
          constraints: [],
          primaryKey: { kind: 'single' as const, columnId: 'col-1' },
        },
      ],
    });

    expect(result.isOk()).toBe(true);
    const report = result._unsafeUnwrap();
    expect(report.valid).toBe(false);
    expect(report.errors.some((e) => e.code === 'NAME_NOT_SNAKE_CASE')).toBe(true);
  });

  it('emits a validation_failed audit event when schema is invalid', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    // Table missing primary key
    await service.validateSchema(ctx, schema.id, {
      tables: [
        {
          id: 'tbl-1',
          name: 'bad_table',
          columns: [],
          indexes: [],
          foreignKeys: [],
          constraints: [],
          primaryKey: null as unknown as { kind: 'single'; columnId: string },
        },
      ],
    });

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'data_management.schema.validation_failed' }),
    );
  });
});

// ── exportSchema ───────────────────────────────────────────────────────────────

describe('SchemaService.exportSchema', () => {
  it('exports as JSON', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Blog', slug: 'blog', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const result = await service.exportSchema(ctx, schema.id, 'json');

    expect(result.isOk()).toBe(true);
    const json = JSON.parse(result._unsafeUnwrap()) as CustomerSchema;
    expect(json.name).toBe('Blog');
    expect(json.slug).toBe('blog');
  });

  it('exports as markdown containing table headers', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Blog', slug: 'blog', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const result = await service.exportSchema(ctx, schema.id, 'markdown');

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toContain('# Schema: Blog');
  });

  it('emits a schema.exported audit event', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Blog', slug: 'blog', databaseDriver: 'postgres' })
    )._unsafeUnwrap();
    await service.exportSchema(ctx, schema.id, 'json');

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'data_management.schema.exported', outcome: 'success' }),
    );
  });
});

// ── deleteSchema ───────────────────────────────────────────────────────────────

describe('SchemaService.deleteSchema', () => {
  it('soft-deletes a schema', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    const schema = (
      await service.createSchema(ctx, { name: 'Test', slug: 'test', databaseDriver: 'postgres' })
    )._unsafeUnwrap();

    const result = await service.deleteSchema(ctx, {
      schemaId: schema.id,
      expectedVersion: 1,
      dropCustomerTables: false,
    });

    expect(result.isOk()).toBe(true);
    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'data_management.schema.deleted', outcome: 'success' }),
    );
  });
});
