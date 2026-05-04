import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type { RateLimiterPort } from '@platform/ports-rate-limiter';

import {
  parse,
  validate,
  execute,
  specifiedRules,
  getOperationAST,
  GraphQLError,
  Kind,
  type DocumentNode,
  type ValidationRule,
} from 'graphql';

import type { PerWorkspaceRepositoryFactory } from '../per-workspace-repository-factory.js';
import type { CustomerSchema } from '../schema-model.js';
import type { SchemaService } from '../schema.service.js';
import type { RequestLoaders } from './dataloader-factory.js';

import { toAuditActor, auditMeta } from '../../../context.js';
import { GRAPHQL_AUDIT_EVENTS } from '../audit-events.js';
import { DataLoaderFactory } from './dataloader-factory.js';
import { GraphQLSchemaBuilder } from './schema-builder.js';

// ── Public API types ───────────────────────────────────────────────────────────

export interface ConnectionArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

/** The execution context passed to every GraphQL resolver. */
export interface GraphQLContext {
  ctx: RequestContext;
  customerSchema: CustomerSchema;
  repos: PerWorkspaceRepositoryFactory;
  dataloaders: RequestLoaders;
  authz: AuthorizationPort;
  audit: AuditPort;
  logger: LoggerPort;
}

/** Platform-agnostic inbound GraphQL request. */
export interface GraphQLApiRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
  /** Authenticated principal context; workspaceId must be set. */
  ctx: RequestContext;
  /** URL slug of the schema being queried. */
  schemaSlug: string;
  /** Workspace slug used for the repository factory cache key. */
  workspaceSlug: string;
}

/** Platform-agnostic outbound GraphQL response. */
export interface GraphQLApiResponse {
  statusCode: number;
  body: {
    data?: unknown;
    errors?: ReadonlyArray<{
      message: string;
      path?: ReadonlyArray<string | number>;
      extensions?: Record<string, unknown>;
    }>;
    extensions?: Record<string, unknown>;
  };
  headers?: Record<string, string>;
}

// ── Depth limit validation rule ────────────────────────────────────────────────

function createDepthLimitRule(maxDepth: number): ValidationRule {
  return (context) => ({
    Field(node, _key, _parent, path) {
      const depth = path.filter((p) => p === 'selectionSet').length;
      if (depth > maxDepth) {
        context.reportError(
          new GraphQLError(
            `Query depth ${String(depth)} exceeds maximum allowed depth of ${String(maxDepth)}.`,
            { nodes: [node] },
          ),
        );
      }
    },
  });
}

// ── Complexity estimation ──────────────────────────────────────────────────────

interface SelectionNode {
  kind: string;
  selectionSet?: { selections: SelectionNode[] };
}

function estimateComplexity(document: DocumentNode, maxComplexity: number): number | null {
  let total = 0;

  function visit(selections: SelectionNode[]): void {
    for (const sel of selections) {
      if (sel.kind !== (Kind.FIELD as string)) continue;
      if (sel.selectionSet && sel.selectionSet.selections.length > 0) {
        total += 1;
        visit(sel.selectionSet.selections);
      }
      if (total > maxComplexity) return;
    }
  }

  for (const def of document.definitions) {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      visit(def.selectionSet.selections as unknown as SelectionNode[]);
    }
  }

  return total > maxComplexity ? total : null;
}

// ── Request handler ────────────────────────────────────────────────────────────

const DEFAULT_MAX_DEPTH = 10;
const DEFAULT_MAX_COMPLEXITY = 1000;
const DEFAULT_RATE_LIMIT_CAPACITY = 500;
const DEFAULT_RATE_LIMIT_REFILL = 500 / 60;

export interface GraphQLRequestHandlerOptions {
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
}

/**
 * Processes incoming GraphQL API requests:
 * 1. Rate limiting
 * 2. Schema resolution (by slug)
 * 3. Document parsing + validation (depth, complexity, spec rules)
 * 4. Execution with per-request DataLoaders
 * 5. Audit on mutations; sampled audit on introspection
 */
export class GraphQLRequestHandler {
  private readonly schemaBuilder = new GraphQLSchemaBuilder();
  private readonly dataloaderFactory = new DataLoaderFactory();
  private readonly maxDepth: number;
  private readonly maxComplexity: number;

  constructor(
    private readonly schemas: SchemaService,
    private readonly authz: AuthorizationPort,
    private readonly repos: PerWorkspaceRepositoryFactory,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly metrics: MetricsPort,
    private readonly rateLimiter: RateLimiterPort,
    opts: GraphQLRequestHandlerOptions = {},
  ) {
    this.maxDepth = opts.maxQueryDepth ?? DEFAULT_MAX_DEPTH;
    this.maxComplexity = opts.maxQueryComplexity ?? DEFAULT_MAX_COMPLEXITY;
  }

  async handle(request: GraphQLApiRequest): Promise<GraphQLApiResponse> {
    const start = Date.now();
    const { ctx } = request;

    this.metrics
      .counter('platform_graphql_queries_total', { description: 'Total GraphQL requests' })
      .add(1, { workspace: request.workspaceSlug });

    // 1. Rate limit
    const bucketKey = `workspace:${request.workspaceSlug}:principal:${ctx.userId}`;
    const rlResult = await this.rateLimiter.check({
      bucketKey,
      capacity: DEFAULT_RATE_LIMIT_CAPACITY,
      refillRate: DEFAULT_RATE_LIMIT_REFILL,
      cost: 1,
    });
    if (rlResult.isOk() && !rlResult.value.allowed) {
      return {
        statusCode: 429,
        body: {
          errors: [
            {
              message: 'Rate limit exceeded.',
              extensions: { code: 'RATE_LIMITED', correlationId: ctx.correlationId },
            },
          ],
        },
        headers: {
          'Retry-After': String(Math.ceil((rlResult.value.retryAfterMs ?? 60000) / 1000)),
        },
      };
    }

    // 2. Schema resolution
    const schemaResult = await this.schemas.resolveDeployedSchema(ctx, request.schemaSlug);
    if (schemaResult.isErr()) {
      return errorResponse(
        'Schema not found or not deployed.',
        'NOT_FOUND',
        ctx.correlationId,
        404,
      );
    }
    const customerSchema = schemaResult.value;

    // 3. Parse query
    let document: DocumentNode;
    try {
      document = parse(request.query);
    } catch (e) {
      return errorResponse(
        `Syntax error: ${e instanceof Error ? e.message : String(e)}`,
        'GRAPHQL_PARSE_FAILED',
        ctx.correlationId,
        400,
      );
    }

    // 4. Get/build GraphQL schema (cached per schema version)
    const { schema } = this.schemaBuilder.getOrBuild(customerSchema);

    // 5. Detect introspection and emit sampled audit event
    const isIntrospection = document.definitions.some(
      (d) =>
        d.kind === Kind.OPERATION_DEFINITION &&
        d.selectionSet.selections.some(
          (s) =>
            s.kind === Kind.FIELD && (s.name.value === '__schema' || s.name.value === '__type'),
        ),
    );
    if (isIntrospection) {
      void this.audit.write({
        eventType: GRAPHQL_AUDIT_EVENTS.INTROSPECTION_QUERY,
        actor: toAuditActor(ctx),
        workspaceId: ctx.workspaceId as string,
        resource: { type: 'graphql_schema', id: customerSchema.slug },
        action: 'introspect',
        outcome: 'success',
        correlationId: ctx.correlationId,
        metadata: { schemaSlug: request.schemaSlug },
        ...auditMeta(ctx),
      });
    }

    // 6. Validate (spec rules + depth limit)
    const depthRule = createDepthLimitRule(this.maxDepth);
    const validationErrors = validate(schema, document, [...specifiedRules, depthRule]);

    if (validationErrors.length > 0) {
      const hasDepthError = validationErrors.some((e) =>
        e.message.includes('exceeds maximum allowed depth'),
      );

      if (hasDepthError) {
        void this.audit.write({
          eventType: GRAPHQL_AUDIT_EVENTS.QUERY_DEPTH_EXCEEDED,
          actor: toAuditActor(ctx),
          workspaceId: ctx.workspaceId as string,
          resource: { type: 'graphql_schema', id: customerSchema.slug },
          action: 'query',
          outcome: 'failure',
          correlationId: ctx.correlationId,
          metadata: { maxDepth: this.maxDepth },
          ...auditMeta(ctx),
        });
      }

      return {
        statusCode: 400,
        body: {
          errors: validationErrors.map((e) => ({
            message: e.message,
            ...(e.locations ? { locations: e.locations } : {}),
            extensions: { code: 'VALIDATION_ERROR', correlationId: ctx.correlationId },
          })),
        },
      };
    }

    // 7. Complexity check
    const complexity = estimateComplexity(document, this.maxComplexity);
    if (complexity !== null) {
      this.metrics
        .counter('platform_graphql_complexity_exceeded_total', {
          description: 'GraphQL queries exceeding complexity limit',
        })
        .add(1, { workspace: request.workspaceSlug });

      void this.audit.write({
        eventType: GRAPHQL_AUDIT_EVENTS.QUERY_COMPLEXITY_EXCEEDED,
        actor: toAuditActor(ctx),
        workspaceId: ctx.workspaceId as string,
        resource: { type: 'graphql_schema', id: customerSchema.slug },
        action: 'query',
        outcome: 'failure',
        correlationId: ctx.correlationId,
        metadata: { complexity, maxComplexity: this.maxComplexity },
        ...auditMeta(ctx),
      });

      return errorResponse(
        `Query complexity ${String(complexity)} exceeds the maximum allowed complexity of ${String(this.maxComplexity)}.`,
        'QUERY_TOO_COMPLEX',
        ctx.correlationId,
        400,
      );
    }

    // 8. Build per-request DataLoaders
    const dataloaders = this.dataloaderFactory.forRequest(
      request.workspaceSlug,
      customerSchema,
      this.repos,
    );

    // 9. Execute
    const gqlContext: GraphQLContext = {
      ctx,
      customerSchema,
      repos: this.repos,
      dataloaders,
      authz: this.authz,
      audit: this.audit,
      logger: this.logger,
    };

    const result = await execute({
      schema,
      document,
      contextValue: gqlContext,
      variableValues: request.variables,
      operationName: request.operationName,
    });

    // 10. Observability
    const duration = Date.now() - start;
    const opAst = getOperationAST(document, request.operationName ?? null);
    const opName = opAst?.name?.value ?? 'anonymous';

    this.metrics
      .histogram('platform_graphql_query_duration_seconds', {
        description: 'GraphQL query duration',
      })
      .record(duration / 1000, { workspace: request.workspaceSlug, operation_name: opName });

    if (duration > 2000) {
      this.logger.warn('Slow GraphQL query', {
        operationName: opName,
        durationMs: duration,
        workspace: request.workspaceSlug,
        schemaSlug: request.schemaSlug,
      });
    }

    // Attach correlationId to every error extension
    const responseErrors = result.errors?.map((e) => ({
      message: e.message,
      ...(e.path ? { path: e.path } : {}),
      extensions: {
        ...e.extensions,
        code: (e.extensions['code'] as string | undefined) ?? 'INTERNAL_ERROR',
        correlationId: ctx.correlationId,
      },
    }));

    return {
      statusCode: 200,
      body: {
        ...(result.data !== undefined ? { data: result.data } : {}),
        ...(responseErrors && responseErrors.length > 0 ? { errors: responseErrors } : {}),
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': ctx.correlationId,
      },
    };
  }

  /** Invalidate the schema cache after a deploy. */
  invalidateSchema(schemaId: string): void {
    this.schemaBuilder.invalidate(schemaId);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function errorResponse(
  message: string,
  code: string,
  correlationId: string,
  statusCode = 400,
): GraphQLApiResponse {
  return {
    statusCode,
    body: {
      errors: [{ message, extensions: { code, correlationId } }],
    },
  };
}
