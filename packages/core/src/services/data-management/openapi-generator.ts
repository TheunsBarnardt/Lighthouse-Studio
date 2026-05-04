import type {
  CustomerSchema,
  CustomerTableDefinition,
  ColumnDefinition,
  NormalizedType,
} from './schema-model.js';

// ── OpenAPI 3.1 types (minimal subset needed for generation) ──────────────────

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string; description?: string };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, OpenApiPathItem>;
  components: {
    schemas: Record<string, OpenApiSchema>;
    securitySchemes: Record<string, OpenApiSecurityScheme>;
    responses: Record<string, OpenApiResponse>;
  };
  security: Array<Record<string, string[]>>;
}

interface OpenApiPathItem {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
}

interface OpenApiOperation {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  parameters?: OpenApiParameter[];
  requestBody?: { required: boolean; content: Record<string, { schema: OpenApiSchema }> };
  responses: Record<string, OpenApiResponse | { $ref: string }>;
}

interface OpenApiParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  required: boolean;
  description?: string;
  schema: OpenApiSchema;
}

interface OpenApiSchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  required?: string[];
  nullable?: boolean;
  enum?: unknown[];
  $ref?: string;
  readOnly?: boolean;
  example?: unknown;
  maxItems?: number;
  maxLength?: number;
}

interface OpenApiResponse {
  description: string;
  content?: Record<string, { schema: OpenApiSchema }>;
}

interface OpenApiSecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  description?: string;
  name?: string;
  in?: string;
}

// ── Workspace info needed for the spec ────────────────────────────────────────

export interface WorkspaceInfo {
  slug: string;
  name: string;
  /** Base URL of the platform API, e.g. https://platform.example.com */
  baseUrl: string;
}

// ── Pure generator ─────────────────────────────────────────────────────────────

export class OpenApiGenerator {
  /**
   * Generate a complete OpenAPI 3.1 document for a workspace's deployed schema.
   * Pure function — no I/O, no side effects. The result is cacheable per (workspaceId, schemaVersion).
   */
  generate(workspace: WorkspaceInfo, schema: CustomerSchema): OpenApiDocument {
    const apiBase = `${workspace.baseUrl}/api/v1/data/${workspace.slug}/${schema.slug}`;

    const doc: OpenApiDocument = {
      openapi: '3.1.0',
      info: {
        title: `${workspace.name} — ${schema.name} API`,
        version: `schema-v${String(schema.metadata.deployedVersion ?? schema.version)}`,
        description: schema.description
          ? `${schema.description}\n\nAuto-generated from the live schema. Do not edit manually.`
          : 'Auto-generated from the live schema. Do not edit manually.',
      },
      servers: [
        {
          url: apiBase,
          description: `${workspace.name} / ${schema.name}`,
        },
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT or API key',
            description: 'Session token (JWT) or API key (pkey_<prefix>_<secret>)',
          },
        },
        responses: {
          ProblemDetails: {
            description: 'RFC 7807 Problem Details error',
            content: {
              'application/problem+json': {
                schema: { $ref: '#/components/schemas/ProblemDetails' },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    };

    // ── Shared component schemas ──────────────────────────────────────────────

    doc.components.schemas['ProblemDetails'] = {
      type: 'object',
      description: 'RFC 7807 Problem Details',
      properties: {
        type: { type: 'string', format: 'uri' },
        title: { type: 'string' },
        status: { type: 'integer' },
        detail: { type: 'string' },
        instance: { type: 'string', format: 'uri-reference' },
        correlationId: { type: 'string' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    };

    // ── Per-table paths and schemas ───────────────────────────────────────────

    for (const t of schema.tables) {
      this.addTableSchemas(doc, t);
      this.addTablePaths(doc, t);
    }

    return doc;
  }

  // ── Table schema generation ─────────────────────────────────────────────────

  private addTableSchemas(doc: OpenApiDocument, table: CustomerTableDefinition): void {
    const props: Record<string, OpenApiSchema> = {};
    const requiredCols: string[] = [];

    for (const col of table.columns) {
      props[col.name] = this.columnSchema(col);
      if (!col.nullable) requiredCols.push(col.name);
    }

    // Full row schema (returned by GET endpoints)
    doc.components.schemas[this.rowSchemaName(table)] = {
      type: 'object',
      ...(table.description ? { description: table.description } : {}),
      properties: props,
      required: requiredCols,
    };

    // Write schema (used by POST / PUT body — excludes auto-generated columns)
    const writableProps: Record<string, OpenApiSchema> = {};
    const writableRequired: string[] = [];
    for (const col of table.columns) {
      const isAutoGenerated =
        col.defaultValue?.kind === 'function' ||
        col.defaultValue?.kind === 'sequence' ||
        col.generated !== undefined;
      if (!isAutoGenerated) {
        writableProps[col.name] = this.columnSchema(col);
        if (!col.nullable && !col.defaultValue) writableRequired.push(col.name);
      }
    }

    doc.components.schemas[this.writeSchemaName(table)] = {
      type: 'object',
      properties: writableProps,
      required: writableRequired,
    };

    // Collection response schema
    doc.components.schemas[this.collectionSchemaName(table)] = {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: `#/components/schemas/${this.rowSchemaName(table)}` },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'integer', description: 'Total matching rows (before pagination)' },
            limit: { type: 'integer' },
            nextCursor: { type: 'string', nullable: true },
            prevCursor: { type: 'string', nullable: true },
            offset: { type: 'integer', nullable: true },
          },
        },
      },
    };
  }

  private addTablePaths(doc: OpenApiDocument, table: CustomerTableDefinition): void {
    const tag = table.name;
    const rowRef = `#/components/schemas/${this.rowSchemaName(table)}`;
    const collRef = `#/components/schemas/${this.collectionSchemaName(table)}`;
    const writeRef = `#/components/schemas/${this.writeSchemaName(table)}`;
    const problemRef = { $ref: '#/components/responses/ProblemDetails' };

    const commonFilterParams: OpenApiParameter[] = [
      {
        name: 'filter',
        in: 'query',
        required: false,
        description:
          'Filter conditions in bracket syntax: `filter[field][_eq]=value`. Multiple conditions are ANDed.',
        schema: { type: 'string' },
      },
      {
        name: 'fields',
        in: 'query',
        required: false,
        description: 'Comma-separated list of fields to include in the response.',
        schema: { type: 'string' },
      },
      {
        name: 'sort',
        in: 'query',
        required: false,
        description:
          'Comma-separated sort fields. Prefix with `-` for descending: `sort=-created_at,name`.',
        schema: { type: 'string' },
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        description: 'Page size (default 50, max 1000).',
        schema: { type: 'integer', example: 50 },
      },
      {
        name: 'cursor',
        in: 'query',
        required: false,
        description: 'Opaque cursor for cursor-based pagination (from `meta.nextCursor`).',
        schema: { type: 'string' },
      },
      {
        name: 'offset',
        in: 'query',
        required: false,
        description: 'Offset for offset-based pagination. Prefer cursor for large datasets.',
        schema: { type: 'integer' },
      },
      {
        name: 'include_archived',
        in: 'query',
        required: false,
        description: 'Include soft-deleted rows.',
        schema: { type: 'boolean' },
      },
    ];

    // ── Collection path: /<table> ─────────────────────────────────────────────
    doc.paths[`/${table.name}`] = {
      get: {
        operationId: `list_${table.name}`,
        summary: `List ${table.name}`,
        tags: [tag],
        parameters: commonFilterParams,
        responses: {
          '200': {
            description: 'Success',
            content: { 'application/json': { schema: { $ref: collRef } } },
          },
          '400': problemRef,
          '401': problemRef,
          '403': problemRef,
          '429': problemRef,
        },
      },
      post: {
        operationId: `create_${table.name}`,
        summary: `Create a ${table.name} row`,
        tags: [tag],
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: false,
            description: 'Client-generated idempotency key for safe retries.',
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: writeRef } } },
        },
        responses: {
          '201': {
            description: 'Created',
            content: { 'application/json': { schema: { $ref: rowRef } } },
          },
          '400': problemRef,
          '401': problemRef,
          '403': problemRef,
          '409': problemRef,
          '429': problemRef,
        },
      },
    };

    // ── Bulk create: /<table>/bulk ────────────────────────────────────────────
    doc.paths[`/${table.name}/bulk`] = {
      post: {
        operationId: `bulk_create_${table.name}`,
        summary: `Bulk create ${table.name} rows`,
        description: 'Creates up to 1000 rows in a single transaction.',
        tags: [tag],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'array', items: { $ref: writeRef }, maxItems: 1000 },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: rowRef } } } },
          },
          '400': problemRef,
          '401': problemRef,
          '403': problemRef,
          '429': problemRef,
        },
      },
    };

    // ── Count: /<table>/count ─────────────────────────────────────────────────
    doc.paths[`/${table.name}/count`] = {
      get: {
        operationId: `count_${table.name}`,
        summary: `Count ${table.name} rows`,
        tags: [tag],
        parameters: [commonFilterParams[0] as OpenApiParameter],
        responses: {
          '200': {
            description: 'Count result',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { count: { type: 'integer' } } },
              },
            },
          },
          '400': problemRef,
          '401': problemRef,
          '403': problemRef,
        },
      },
    };

    // ── Row path: /<table>/{id} ───────────────────────────────────────────────
    const idParam: OpenApiParameter = {
      name: 'id',
      in: 'path',
      required: true,
      description: 'Row primary key.',
      schema: { type: 'string' },
    };

    doc.paths[`/${table.name}/{id}`] = {
      get: {
        operationId: `get_${table.name}`,
        summary: `Get a ${table.name} row by id`,
        tags: [tag],
        parameters: [
          idParam,
          {
            name: 'fields',
            in: 'query',
            required: false,
            description: 'Sparse fieldset.',
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Success',
            content: { 'application/json': { schema: { $ref: rowRef } } },
          },
          '401': problemRef,
          '403': problemRef,
          '404': problemRef,
        },
      },
      put: {
        operationId: `update_${table.name}`,
        summary: `Update a ${table.name} row`,
        description: 'Full replacement. Include `_version` for optimistic locking.',
        tags: [tag],
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: writeRef } } },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: { 'application/json': { schema: { $ref: rowRef } } },
          },
          '400': problemRef,
          '401': problemRef,
          '403': problemRef,
          '404': problemRef,
          '409': problemRef,
        },
      },
      patch: {
        operationId: `patch_${table.name}`,
        summary: `Partially update a ${table.name} row`,
        tags: [tag],
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: writeRef } } },
        },
        responses: {
          '200': {
            description: 'Updated',
            content: { 'application/json': { schema: { $ref: rowRef } } },
          },
          '400': problemRef,
          '401': problemRef,
          '403': problemRef,
          '404': problemRef,
          '409': problemRef,
        },
      },
      delete: {
        operationId: `archive_${table.name}`,
        summary: `Soft-delete (archive) a ${table.name} row`,
        description:
          'Marks the row as archived. Pass `?hard=true` for permanent deletion (requires additional permission).',
        tags: [tag],
        parameters: [
          idParam,
          {
            name: 'hard',
            in: 'query',
            required: false,
            description: 'Permanently delete the row.',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '204': { description: 'Archived' },
          '401': problemRef,
          '403': problemRef,
          '404': problemRef,
        },
      },
    };

    // ── Restore: /<table>/{id}/restore ────────────────────────────────────────
    doc.paths[`/${table.name}/{id}/restore`] = {
      post: {
        operationId: `restore_${table.name}`,
        summary: `Restore an archived ${table.name} row`,
        tags: [tag],
        parameters: [idParam],
        responses: {
          '200': {
            description: 'Restored',
            content: { 'application/json': { schema: { $ref: rowRef } } },
          },
          '401': problemRef,
          '403': problemRef,
          '404': problemRef,
        },
      },
    };
  }

  // ── Type mapping ────────────────────────────────────────────────────────────

  private columnSchema(col: ColumnDefinition): OpenApiSchema {
    const base = this.normalizedTypeToSchema(col.type);
    const schema: OpenApiSchema = { ...base };
    if (col.nullable) schema.nullable = true;
    if (col.description) schema.description = col.description;
    if (col.isPii) {
      schema.description = `${schema.description ?? ''} [PII — may be redacted]`.trim();
    }
    return schema;
  }

  private normalizedTypeToSchema(type: NormalizedType): OpenApiSchema {
    switch (type.kind) {
      case 'string':
        return { type: 'string', ...(type.length ? { maxLength: type.length } : {}) };
      case 'text':
        return { type: 'string' };
      case 'integer':
        return { type: 'integer', format: 'int32' };
      case 'bigint':
        return { type: 'integer', format: 'int64' };
      case 'decimal':
        return {
          type: 'string',
          format: 'decimal',
          description: `Decimal(${String(type.precision)},${String(type.scale)}). Returned as string to preserve precision.`,
        };
      case 'boolean':
        return { type: 'boolean' };
      case 'date':
        return { type: 'string', format: 'date' };
      case 'timestamp':
        return { type: 'string', format: 'date-time' };
      case 'timestamp_tz':
        return { type: 'string', format: 'date-time' };
      case 'uuid':
        return { type: 'string', format: 'uuid' };
      case 'binary':
        return { type: 'string', format: 'byte', description: 'Base64-encoded binary.' };
      case 'json':
        return { type: 'object' };
      case 'array':
        return { type: 'array', items: this.normalizedTypeToSchema(type.elementType) };
    }
  }

  // ── Naming helpers ──────────────────────────────────────────────────────────

  private rowSchemaName(table: CustomerTableDefinition): string {
    return `${pascalCase(table.name)}Row`;
  }

  private writeSchemaName(table: CustomerTableDefinition): string {
    return `${pascalCase(table.name)}Write`;
  }

  private collectionSchemaName(table: CustomerTableDefinition): string {
    return `${pascalCase(table.name)}Collection`;
  }
}

function pascalCase(s: string): string {
  return s.replace(/(^|_)([a-z])/g, (_, _sep, char: string) => char.toUpperCase());
}
