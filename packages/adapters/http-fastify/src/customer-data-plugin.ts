import type {
  ApiRequestHandler,
  ApiKeyService,
  ApiKeyPrincipal,
  ApiRequest,
  HttpMethod,
  CustomerSchema,
  OpenApiGenerator,
  WorkspaceInfo,
} from '@platform/core';
import type { RequestContext } from '@platform/ports-authorization';
import type { SessionPort } from '@platform/ports-identity';
import type { LoggerPort, TracerPort } from '@platform/ports-observability';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

// ── Plugin options ────────────────────────────────────────────────────────────

export type WorkspaceResolver = (
  slug: string,
) => Promise<{ id: string; slug: string; name: string } | null>;
export type SchemaResolver = (
  workspaceId: string,
  schemaSlug: string,
) => Promise<CustomerSchema | null>;

// ── Workspace cache ───────────────────────────────────────────────────────────

const WORKSPACE_CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function makeCache<T>() {
  const map = new Map<string, CacheEntry<T>>();
  return {
    get(key: string): T | undefined {
      const entry = map.get(key);
      if (!entry || Date.now() > entry.expiresAt) {
        map.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: T, ttlMs: number): void {
      map.set(key, { value, expiresAt: Date.now() + ttlMs });
    },
  };
}

export interface CustomerDataPluginOptions {
  handler: ApiRequestHandler;
  apiKeys: ApiKeyService;
  logger: LoggerPort;
  tracer: TracerPort;
  openApiGenerator: OpenApiGenerator;
  /** Resolves a workspace slug to its UUID and display name. */
  resolveWorkspace: WorkspaceResolver;
  /** Resolves a workspace's deployed schema by slug. */
  resolveSchema: SchemaResolver;
  /** Base URL for the platform API, used in OpenAPI server URLs. */
  baseUrl: string;
  /**
   * Optional session port. When provided, Bearer tokens that are not API keys
   * are verified as platform sessions. Without this, only API key auth is supported.
   */
  sessions?: SessionPort;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCorrelationId(req: FastifyRequest): string {
  return (req.headers['x-correlation-id'] as string | undefined) ?? req.id;
}

function makeApiKeyContext(
  keyId: string,
  workspaceId: string,
  cid: string,
  req: FastifyRequest,
): RequestContext {
  const ua = req.headers['user-agent'];
  const idemKey = req.headers['idempotency-key'] as string | undefined;
  return {
    userId: keyId,
    workspaceId,
    installationRoles: [],
    correlationId: cid,
    ipAddress: req.ip,
    ...(ua !== undefined ? { userAgent: ua } : {}),
    ...(idemKey !== undefined ? { idempotencyKey: idemKey } : {}),
    mfaSatisfied: false,
    _kind: 'service_account',
  };
}

// ── Auth result ───────────────────────────────────────────────────────────────

type AuthOk = { ok: true; ctx: RequestContext; principal: ApiKeyPrincipal | null };
type AuthFail = { ok: false; status: 401; reason: string };
type AuthResult = AuthOk | AuthFail;

async function resolveAuth(
  req: FastifyRequest,
  apiKeys: ApiKeyService,
  resolveWorkspace: WorkspaceResolver,
  cid: string,
  workspaceSlug: string,
  sessions?: SessionPort,
): Promise<AuthResult> {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return { ok: false, status: 401, reason: 'Authentication required' };
  }

  // ── API key path ─────────────────────────────────────────────────────────
  if (authHeader.startsWith('Bearer pkey_')) {
    const rawKey = authHeader.slice('Bearer '.length);
    const result = await apiKeys.verify(rawKey);
    if (result.isErr()) {
      return { ok: false, status: 401, reason: 'Invalid or revoked API key' };
    }
    const principal = result.value;
    const workspace = await resolveWorkspace(workspaceSlug);
    if (!workspace || workspace.id !== principal.workspaceId) {
      return { ok: false, status: 401, reason: 'API key is not valid for this workspace' };
    }
    const ctx = makeApiKeyContext(principal.keyId, principal.workspaceId, cid, req);
    return { ok: true, ctx, principal };
  }

  // ── Session bearer token path ─────────────────────────────────────────────
  if (authHeader.startsWith('Bearer ') && sessions) {
    const token = authHeader.slice('Bearer '.length);
    const sessionResult = await sessions.findByToken(token);
    if (sessionResult.isErr() || !sessionResult.value) {
      return { ok: false, status: 401, reason: 'Invalid or expired session token' };
    }
    const session = sessionResult.value;

    if (session.expiresAt < new Date()) {
      return { ok: false, status: 401, reason: 'Session has expired' };
    }

    // Resolve the workspace and verify the session is scoped to it (or is installation-wide)
    const workspace = await resolveWorkspace(workspaceSlug);
    if (!workspace) {
      return { ok: false, status: 401, reason: `Workspace '${workspaceSlug}' not found` };
    }
    if (session.workspaceId !== null && session.workspaceId !== workspace.id) {
      return { ok: false, status: 401, reason: 'Session is not valid for this workspace' };
    }

    const ua = req.headers['user-agent'];
    const idemKey = req.headers['idempotency-key'] as string | undefined;
    const ctx: RequestContext = {
      userId: session.userId,
      workspaceId: workspace.id,
      installationRoles: [],
      correlationId: cid,
      ipAddress: session.ipAddress ?? req.ip,
      ...(ua !== undefined ? { userAgent: ua } : {}),
      ...(idemKey !== undefined ? { idempotencyKey: idemKey } : {}),
      mfaSatisfied: false,
      _kind: 'user',
    };

    // Touch session (sliding expiry) — fire-and-forget, never block the request
    void sessions.touch(session.id).catch(() => undefined);

    return { ok: true, ctx, principal: null };
  }

  return { ok: false, status: 401, reason: 'Authentication required' };
}

// ── Problem detail helper ─────────────────────────────────────────────────────

function problemDetail(status: number, title: string, detail: string, cid: string): object {
  const slug = title.toLowerCase().replace(/\s+/g, '_');
  return {
    type: `https://platform.example.com/errors/${slug}`,
    title,
    status,
    detail,
    correlationId: cid,
  };
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const customerDataPlugin: FastifyPluginAsync<CustomerDataPluginOptions> = async (
  fastify: FastifyInstance,
  opts: CustomerDataPluginOptions,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const {
    handler,
    apiKeys,
    logger,
    tracer,
    openApiGenerator,
    resolveWorkspace,
    resolveSchema,
    baseUrl,
    sessions,
  } = opts;

  const workspaceCache = makeCache<{ id: string; slug: string; name: string }>();

  async function cachedResolveWorkspace(slug: string) {
    const cached = workspaceCache.get(slug);
    if (cached) return cached;
    const result = await resolveWorkspace(slug);
    if (result) workspaceCache.set(slug, result, WORKSPACE_CACHE_TTL_MS);
    return result;
  }

  // ── Dispatch helper ───────────────────────────────────────────────────────

  async function dispatch(
    req: FastifyRequest,
    reply: FastifyReply,
    method: HttpMethod,
    workspaceSlug: string,
    schemaSlug: string,
    table: string,
    id?: string,
    subresource?: 'bulk' | 'count' | 'restore',
  ): Promise<void> {
    const cid = getCorrelationId(req);
    const authResult = await resolveAuth(
      req,
      apiKeys,
      cachedResolveWorkspace,
      cid,
      workspaceSlug,
      sessions,
    );

    if (!authResult.ok) {
      void reply
        .status(authResult.status)
        .header('Content-Type', 'application/problem+json')
        .header('X-Correlation-Id', cid)
        .send(problemDetail(authResult.status, 'Unauthorized', authResult.reason, cid));
      return;
    }

    const apiRequest: ApiRequest = {
      method,
      params: {
        workspaceSlug,
        schemaSlug,
        table,
        ...(id !== undefined ? { id } : {}),
        ...(subresource !== undefined ? { subresource } : {}),
      },
      queryParams: req.query as Record<string, string | string[]>,
      body: ['POST', 'PUT', 'PATCH'].includes(method) ? req.body : undefined,
      ctx: authResult.ctx,
      principal: authResult.principal,
    };

    // Propagate incoming trace context into the current span
    tracer.extract(req.headers as Record<string, string>);

    const result = await handler.handle(apiRequest);

    // Inject outbound trace headers
    const traceHeaders: Record<string, string> = {};
    tracer.inject(traceHeaders);
    for (const [k, v] of Object.entries(traceHeaders)) {
      void reply.header(k, v);
    }

    if (result.isErr()) {
      const e = result.error;
      const status = 'statusCode' in e ? e.statusCode : 500;
      void reply
        .status(status)
        .header('Content-Type', 'application/problem+json')
        .header('X-Correlation-Id', cid)
        .send(problemDetail(status, 'Error', e.message, cid));
      return;
    }

    const response = result.value;
    for (const [key, value] of Object.entries(response.headers ?? {})) {
      void reply.header(key, value);
    }
    void reply.header('X-Correlation-Id', cid);

    void reply.status(response.statusCode).send(response.body);
  }

  // ── OpenAPI spec endpoint ─────────────────────────────────────────────────

  fastify.get<{ Params: { workspaceSlug: string; schemaSlug: string } }>(
    '/:schemaSlug/openapi.json',
    async (req, reply) => {
      const cid = getCorrelationId(req);
      const { workspaceSlug, schemaSlug } = req.params;

      const authHeader = req.headers['authorization'];
      if (!authHeader?.startsWith('Bearer pkey_')) {
        void reply
          .status(401)
          .header('Content-Type', 'application/problem+json')
          .send(problemDetail(401, 'Unauthorized', 'Authentication required', cid));
        return;
      }

      const workspace = await cachedResolveWorkspace(workspaceSlug);
      if (!workspace) {
        void reply
          .status(404)
          .header('Content-Type', 'application/problem+json')
          .send(problemDetail(404, 'Not Found', `Workspace '${workspaceSlug}' not found`, cid));
        return;
      }

      const rawKey = authHeader.slice('Bearer '.length);
      const keyResult = await apiKeys.verify(rawKey);
      if (keyResult.isErr() || keyResult.value.workspaceId !== workspace.id) {
        void reply
          .status(401)
          .header('Content-Type', 'application/problem+json')
          .send(problemDetail(401, 'Unauthorized', 'Invalid or revoked API key', cid));
        return;
      }

      const schema = await resolveSchema(workspace.id, schemaSlug);
      if (!schema) {
        void reply
          .status(404)
          .header('Content-Type', 'application/problem+json')
          .send(
            problemDetail(
              404,
              'Not Found',
              `Schema '${schemaSlug}' not found in workspace '${workspaceSlug}'`,
              cid,
            ),
          );
        return;
      }

      const workspaceInfo: WorkspaceInfo = { slug: workspace.slug, name: workspace.name, baseUrl };
      const spec = openApiGenerator.generate(workspaceInfo, schema);

      void reply
        .status(200)
        .header('Content-Type', 'application/json')
        .header('X-Correlation-Id', cid)
        .header('Cache-Control', `public, max-age=60, s-maxage=300`)
        .send(spec);
    },
  );

  // ── API explorer (Swagger UI) ─────────────────────────────────────────────

  fastify.get<{ Params: { workspaceSlug: string; schemaSlug: string } }>(
    '/:schemaSlug/docs',
    async (req, reply) => {
      const { workspaceSlug, schemaSlug } = req.params;
      const specUrl = `/${workspaceSlug}/${schemaSlug}/openapi.json`;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Explorer — ${schemaSlug}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
  SwaggerUIBundle({
    url: '${specUrl}',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    requestInterceptor: function(req) {
      var key = localStorage.getItem('pf_api_key_${workspaceSlug}');
      if (key) req.headers['Authorization'] = 'Bearer ' + key;
      return req;
    }
  });
</script>
</body>
</html>`;
      void reply
        .status(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .header('Cache-Control', 'no-store')
        .send(html);
    },
  );

  // ── Collection routes ─────────────────────────────────────────────────────

  type P3 = { workspaceSlug: string; schemaSlug: string; table: string };
  type P4 = { workspaceSlug: string; schemaSlug: string; table: string; id: string };

  fastify.get<{ Params: P3 }>('/:schemaSlug/:table', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'GET',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
    );
  });

  fastify.post<{ Params: P3 }>('/:schemaSlug/:table', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'POST',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
    );
  });

  fastify.patch<{ Params: P3 }>('/:schemaSlug/:table', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'PATCH',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
    );
  });

  fastify.delete<{ Params: P3 }>('/:schemaSlug/:table', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'DELETE',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
    );
  });

  // ── Sub-collection routes ─────────────────────────────────────────────────

  fastify.get<{ Params: P3 }>('/:schemaSlug/:table/count', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'GET',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
      undefined,
      'count',
    );
  });

  fastify.post<{ Params: P3 }>('/:schemaSlug/:table/bulk', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'POST',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
      undefined,
      'bulk',
    );
  });

  // ── Row routes ────────────────────────────────────────────────────────────

  fastify.get<{ Params: P4 }>('/:schemaSlug/:table/:id', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'GET',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
      req.params.id,
    );
  });

  fastify.put<{ Params: P4 }>('/:schemaSlug/:table/:id', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'PUT',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
      req.params.id,
    );
  });

  fastify.patch<{ Params: P4 }>('/:schemaSlug/:table/:id', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'PATCH',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
      req.params.id,
    );
  });

  fastify.delete<{ Params: P4 }>('/:schemaSlug/:table/:id', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'DELETE',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
      req.params.id,
    );
  });

  fastify.post<{ Params: P4 }>('/:schemaSlug/:table/:id/restore', async (req, reply) => {
    await dispatch(
      req,
      reply,
      'POST',
      req.params.workspaceSlug,
      req.params.schemaSlug,
      req.params.table,
      req.params.id,
      'restore',
    );
  });

  logger.info('Customer data API routes registered');
};

export default customerDataPlugin;
