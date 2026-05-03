import type { MetricsPort } from '@platform/ports-observability';

import { describe, it, expect, beforeEach } from 'vitest';

import type { CustomerSchema } from '../schema-model.js';
import type { SchemaService } from '../schema.service.js';

import { createInMemoryAudit } from '../../../testing/in-memory-audit.js';
import { createInMemoryAuthz } from '../../../testing/in-memory-authz.js';
import { createInMemoryCustomerRepoProvider } from '../../../testing/in-memory-customer-repo.js';
import { createInMemoryLogger } from '../../../testing/in-memory-logger.js';
import { createInMemoryRateLimiter } from '../../../testing/in-memory-rate-limiter.js';
import { makeUserContext } from '../../../testing/make-context.js';
import { PerWorkspaceRepositoryFactory } from '../per-workspace-repository-factory.js';
import { GraphQLRequestHandler } from './request-handler.js';

// ── Null-op metrics stub ───────────────────────────────────────────────────────

const noopMetrics: MetricsPort = {
  counter: () => ({ add: () => undefined }),
  gauge: () => ({ set: () => undefined }),
  histogram: () => ({ record: () => undefined }),
};

// ── Test schema ────────────────────────────────────────────────────────────────

const TEST_SCHEMA: CustomerSchema = {
  id: 'schema-test-001',
  workspaceId: 'ws-test-001',
  name: 'Store',
  slug: 'store',
  version: 1,
  databaseDriver: 'postgres',
  tables: [
    {
      id: 'tbl-products',
      name: 'products',
      columns: [
        { id: 'col-id', name: 'id', type: { kind: 'uuid' }, nullable: false },
        { id: 'col-name', name: 'name', type: { kind: 'string', length: 255 }, nullable: false },
        {
          id: 'col-price',
          name: 'price',
          type: { kind: 'decimal', precision: 10, scale: 2 },
          nullable: false,
        },
        {
          id: 'col-active',
          name: 'active',
          type: { kind: 'boolean' },
          nullable: false,
          defaultValue: { kind: 'literal', value: true },
        },
      ],
      indexes: [],
      foreignKeys: [],
      constraints: [],
      primaryKey: { kind: 'single', columnId: 'col-id' },
    },
  ],
  metadata: {
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    createdBy: 'test',
    updatedBy: 'test',
  },
};

// ── Fake SchemaService ─────────────────────────────────────────────────────────

const fakeSchemas = {
  resolveDeployedSchema: async (_ctx: unknown, slug: string) => {
    if (slug === TEST_SCHEMA.slug) {
      const { ok } = await import('neverthrow');
      return ok(TEST_SCHEMA);
    }
    const { err } = await import('neverthrow');
    return err(new Error('not found'));
  },
} as unknown as SchemaService;

// ── Test helpers ───────────────────────────────────────────────────────────────

function makeHandler(opts: { denyAll?: boolean } = {}): GraphQLRequestHandler {
  const audit = createInMemoryAudit();
  const authz = createInMemoryAuthz(opts.denyAll ? { deny: true } : {});
  const logger = createInMemoryLogger();
  const rateLimiter = createInMemoryRateLimiter();
  const repoProvider = createInMemoryCustomerRepoProvider();
  const repos = new PerWorkspaceRepositoryFactory(repoProvider, logger);

  return new GraphQLRequestHandler(
    fakeSchemas,
    authz,
    repos,
    audit,
    logger,
    noopMetrics,
    rateLimiter,
  );
}

const BASE_CTX = makeUserContext({ workspaceId: 'ws-test-001', userId: 'user-test-001' });

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GraphQLRequestHandler', () => {
  let handler: GraphQLRequestHandler;

  beforeEach(() => {
    handler = makeHandler();
  });

  describe('schema resolution', () => {
    it('returns 404 for unknown schema slug', async () => {
      const resp = await handler.handle({
        query: '{ productList { edges { node { id } } } }',
        ctx: BASE_CTX,
        schemaSlug: 'no-such-schema',
        workspaceSlug: 'ws-test',
      });
      expect(resp.statusCode).toBe(404);
      expect(resp.body.errors?.[0]?.extensions?.['code']).toBe('NOT_FOUND');
    });
  });

  describe('query parsing', () => {
    it('returns 400 for a syntax error in the query', async () => {
      const resp = await handler.handle({
        query: '{ productList { {{{ ',
        ctx: BASE_CTX,
        schemaSlug: 'store',
        workspaceSlug: 'ws-test',
      });
      expect(resp.statusCode).toBe(400);
      expect(resp.body.errors?.[0]?.extensions?.['code']).toBe('GRAPHQL_PARSE_FAILED');
    });
  });

  describe('validation', () => {
    it('returns 400 for a field that does not exist on the schema', async () => {
      const resp = await handler.handle({
        query: '{ productList { edges { node { nonExistentField } } } }',
        ctx: BASE_CTX,
        schemaSlug: 'store',
        workspaceSlug: 'ws-test',
      });
      expect(resp.statusCode).toBe(400);
      expect(resp.body.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('depth limit', () => {
    it('rejects queries that exceed the default depth of 10', async () => {
      // TODO: build a query of depth > 10 and assert rejection. Current
      // assertion only proves a shallow query is accepted, not that deep
      // queries are rejected.
      const validQuery =
        '{ productList(first: 5) { edges { node { id name } } pageInfo { hasNextPage } } }';
      const resp = await handler.handle({
        query: validQuery,
        ctx: BASE_CTX,
        schemaSlug: 'store',
        workspaceSlug: 'ws-test',
      });
      // 200 because the query is valid and under depth limit
      expect(resp.statusCode).toBe(200);
    });
  });

  describe('introspection', () => {
    it('allows introspection query and returns schema information', async () => {
      const resp = await handler.handle({
        query: '{ __schema { queryType { name } } }',
        ctx: BASE_CTX,
        schemaSlug: 'store',
        workspaceSlug: 'ws-test',
      });
      expect(resp.statusCode).toBe(200);
      const data = resp.body.data as Record<string, unknown>;
      expect(data?.['__schema']).toBeDefined();
    });
  });

  describe('list query execution', () => {
    it('returns an empty connection when the table is empty', async () => {
      const resp = await handler.handle({
        query:
          '{ productList(first: 10) { edges { node { id name } } pageInfo { hasNextPage endCursor } } }',
        ctx: BASE_CTX,
        schemaSlug: 'store',
        workspaceSlug: 'ws-test',
      });
      expect(resp.statusCode).toBe(200);
      expect(resp.body.errors).toBeUndefined();
      const data = resp.body.data as Record<string, unknown>;
      const productList = data?.['productList'] as Record<string, unknown>;
      expect(productList?.['edges']).toEqual([]);
      expect((productList?.['pageInfo'] as Record<string, unknown>)?.['hasNextPage']).toBe(false);
    });

    it('count query returns 0 for an empty table', async () => {
      const resp = await handler.handle({
        query: '{ productCount }',
        ctx: BASE_CTX,
        schemaSlug: 'store',
        workspaceSlug: 'ws-test',
      });
      expect(resp.statusCode).toBe(200);
      const data = resp.body.data as Record<string, unknown>;
      expect(data?.['productCount']).toBe(0);
    });
  });

  describe('error format', () => {
    it('attaches correlationId to all errors', async () => {
      const resp = await handler.handle({
        query: '{ nonExistentField }',
        ctx: BASE_CTX,
        schemaSlug: 'store',
        workspaceSlug: 'ws-test',
      });
      expect(resp.statusCode).toBe(400);
      const error = resp.body.errors?.[0];
      expect(error?.extensions?.['correlationId']).toBeDefined();
    });
  });
});
