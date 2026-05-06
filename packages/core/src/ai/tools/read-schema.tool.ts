import type { RequestContext } from '@platform/ports-authorization';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../../errors.js';
import type { SchemaService } from '../../services/data-management/schema.service.js';

import { defineTool } from '../define-tool.js';

const ParamsSchema = z.object({
  schemaId: z.string().describe('The ID of the schema to read'),
});

const ReturnSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  databaseDriver: z.string(),
  version: z.number(),
  tableCount: z.number(),
  tables: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      columnCount: z.number(),
      columns: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.unknown(),
          nullable: z.boolean(),
          isPii: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

type ReadSchemaReturn = z.infer<typeof ReturnSchema>;

/**
 * Creates the `read_schema` AI tool bound to the given SchemaService instance.
 * Register this in the ToolRegistry at startup.
 */
export function createReadSchemaTool(schemas: SchemaService) {
  return defineTool<z.infer<typeof ParamsSchema>, ReadSchemaReturn>({
    id: 'read_schema',
    name: 'read_schema',
    description:
      'Read the definition of a customer schema including its tables and columns. ' +
      'Use this to understand the data model before generating schema-aware artifacts.',
    parameters: ParamsSchema,
    returns: ReturnSchema,
    permissions: ['schema.read'],
    writesToPlatform: false,

    async execute(
      ctx: RequestContext,
      params: z.infer<typeof ParamsSchema>,
    ): Promise<Result<ReadSchemaReturn, AppError>> {
      const result = await schemas.getSchema(ctx, params.schemaId);
      if (result.isErr()) return result as unknown as Result<ReadSchemaReturn, AppError>;

      const schema = result.value;
      return ok({
        id: schema.id,
        name: schema.name,
        slug: schema.slug,
        ...(schema.description !== undefined ? { description: schema.description } : {}),
        databaseDriver: schema.databaseDriver,
        version: schema.version,
        tableCount: schema.tables.length,
        tables: schema.tables.map((t) => ({
          id: t.id,
          name: t.name,
          columnCount: t.columns.length,
          columns: t.columns.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            nullable: c.nullable,
            ...(c.isPii !== undefined ? { isPii: c.isPii } : {}),
          })),
        })),
      });
    },
  });
}
