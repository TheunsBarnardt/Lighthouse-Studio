import { describe, it, expect } from 'vitest';

import type { CustomerSchema, SchemaVersion } from '../schema-model.js';

import { ApprovalRoutingEngine } from '../../../approvals/approval-routing.engine.js';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryDdl,
  createInMemoryIntrospection,
  createInMemoryLogger,
  createInMemoryMigration,
  createInMemoryRepo,
  makeUserContext,
} from '../../../testing/index.js';
import { SchemaValidator } from '../schema-validator.js';
import { SchemaService } from '../schema.service.js';
import { blankTemplate } from './blank.js';
import { blogTemplate } from './blog.js';
import { crmTemplate } from './crm.js';
import { ecommerceTemplate } from './ecommerce.js';
import { getTemplate, listTemplates } from './index.js';
import { taskTrackerTemplate } from './task-tracker.js';

function makeService() {
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
  return service;
}

const ctx = makeUserContext({ userId: 'user-1', workspaceId: 'ws-1' });
const validator = new SchemaValidator();

// ── Registry ──────────────────────────────────────────────────────────────────

describe('template registry', () => {
  it('listTemplates returns all 5 templates', () => {
    const templates = listTemplates();
    expect(templates).toHaveLength(5);
  });

  it('getTemplate returns the correct template by id', () => {
    expect(getTemplate('tpl-blank')?.name).toBe('Blank schema');
    expect(getTemplate('tpl-crm')?.name).toBe('CRM');
    expect(getTemplate('tpl-blog')?.name).toBe('Blog');
    expect(getTemplate('tpl-task-tracker')?.name).toBe('Task tracker');
    expect(getTemplate('tpl-ecommerce')?.name).toBe('E-commerce');
  });

  it('getTemplate returns undefined for unknown id', () => {
    expect(getTemplate('tpl-does-not-exist')).toBeUndefined();
  });
});

// ── Template validity ─────────────────────────────────────────────────────────

const ALL_TEMPLATES = [
  blankTemplate,
  crmTemplate,
  blogTemplate,
  taskTrackerTemplate,
  ecommerceTemplate,
];

describe.each(ALL_TEMPLATES.map((t) => [t.name, t]))(
  'template "%s" validity',
  (_name, template) => {
    it('passes schema validation on postgres', () => {
      const fakeSchema = {
        id: 'schema-1',
        workspaceId: 'ws-1',
        name: template.name,
        slug: template.id.replace('tpl-', ''),
        version: 1,
        databaseDriver: 'postgres' as const,
        tables: template.tables,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-1',
          updatedBy: 'user-1',
        },
      };

      const report = validator.validate(fakeSchema, { tables: template.tables }, 'postgres');
      expect(report.errors).toHaveLength(0);
    });

    it('has at least one table', () => {
      expect(template.tables.length).toBeGreaterThan(0);
    });

    it('all table IDs are unique within the template', () => {
      const tableIds = template.tables.map((t) => t.id);
      expect(new Set(tableIds).size).toBe(tableIds.length);
    });

    it('all column IDs are unique within each table', () => {
      for (const table of template.tables) {
        const colIds = table.columns.map((c) => c.id);
        expect(new Set(colIds).size).toBe(colIds.length);
      }
    });

    it('every table has a primary key referencing an existing column', () => {
      for (const table of template.tables) {
        const colIds = new Set(table.columns.map((c) => c.id));
        const pk = table.primaryKey;
        if (pk.kind === 'single') {
          expect(colIds.has(pk.columnId), `PK column ${pk.columnId} not in ${table.name}`).toBe(
            true,
          );
        } else {
          for (const id of pk.columnIds) {
            expect(colIds.has(id), `PK column ${id} not in ${table.name}`).toBe(true);
          }
        }
      }
    });

    it('all FK referenced tables exist within the template', () => {
      const tableIds = new Set(template.tables.map((t) => t.id));
      for (const table of template.tables) {
        for (const fk of table.foreignKeys) {
          expect(
            tableIds.has(fk.referencedTableId),
            `FK ${fk.name} references unknown table ${fk.referencedTableId}`,
          ).toBe(true);
        }
      }
    });
  },
);

// ── Service integration ───────────────────────────────────────────────────────

describe('createSchemaFromTemplate', () => {
  it('creates a schema with blank template tables', async () => {
    const service = makeService();
    const result = await service.createSchemaFromTemplate(ctx, 'tpl-blank', {
      name: 'My Schema',
      slug: 'my_schema',
      databaseDriver: 'postgres',
    });

    expect(result.isOk()).toBe(true);
    const schema = result._unsafeUnwrap();
    expect(schema.name).toBe('My Schema');
    expect(schema.tables).toHaveLength(blankTemplate.tables.length);
  });

  it('creates a schema with CRM template tables', async () => {
    const service = makeService();
    const result = await service.createSchemaFromTemplate(ctx, 'tpl-crm', {
      name: 'CRM',
      slug: 'crm',
      databaseDriver: 'postgres',
    });

    expect(result.isOk()).toBe(true);
    const schema = result._unsafeUnwrap();
    expect(schema.tables).toHaveLength(crmTemplate.tables.length);
    expect(schema.tables.some((t) => t.name === 'contacts')).toBe(true);
    expect(schema.tables.some((t) => t.name === 'companies')).toBe(true);
  });

  it('returns NOT_FOUND for an unknown template id', async () => {
    const service = makeService();
    const result = await service.createSchemaFromTemplate(ctx, 'tpl-does-not-exist', {
      name: 'Test',
      slug: 'test',
      databaseDriver: 'postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns FORBIDDEN when not authorized', async () => {
    const schemas = createInMemoryRepo<CustomerSchema>();
    const schemaVersions = createInMemoryRepo<SchemaVersion>();
    const service = new SchemaService(
      createInMemoryAuthz({ deny: true }),
      schemas,
      schemaVersions,
      createInMemoryIntrospection(),
      createInMemoryDdl(),
      createInMemoryMigration(),
      createInMemoryAudit(),
      createInMemoryLogger(),
      new ApprovalRoutingEngine(),
    );

    const result = await service.createSchemaFromTemplate(ctx, 'tpl-blank', {
      name: 'Test',
      slug: 'test',
      databaseDriver: 'postgres',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});
