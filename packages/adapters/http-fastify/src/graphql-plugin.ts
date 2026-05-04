import type {
  GraphQLRequestHandler,
  ApiKeyService,
  ApiKeyPrincipal,
  GraphQLApiRequest,
} from '@platform/core';
import type { RequestContext } from '@platform/ports-authorization';
import type { SessionPort } from '@platform/ports-identity';
import type { LoggerPort } from '@platform/ports-observability';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';

import type { WorkspaceResolver } from './customer-data-plugin.js';

// ── Plugin options ─────────────────────────────────────────────────────────────

export interface GraphQLPluginOptions {
  handler: GraphQLRequestHandler;
  apiKeys: ApiKeyService;
  logger: LoggerPort;
  resolveWorkspace: WorkspaceResolver;
  /** Base URL of the platform, used to build the playground endpoint label. */
  baseUrl: string;
  /**
   * Optional session port. When provided, Bearer tokens that are not API keys
   * are verified as platform sessions.
   */
  sessions?: SessionPort;
}

// ── Auth helpers ───────────────────────────────────────────────────────────────

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
  return {
    userId: keyId,
    workspaceId,
    installationRoles: [],
    correlationId: cid,
    ipAddress: req.ip,
    ...(ua !== undefined ? { userAgent: ua } : {}),
    mfaSatisfied: false,
    _kind: 'service_account',
  };
}

type AuthOk = { ok: true; ctx: RequestContext; principal: ApiKeyPrincipal | null };
type AuthFail = { ok: false; status: 401; reason: string };

async function resolveAuth(
  req: FastifyRequest,
  apiKeys: ApiKeyService,
  resolveWorkspace: WorkspaceResolver,
  cid: string,
  workspaceSlug: string,
  sessions?: SessionPort,
): Promise<AuthOk | AuthFail> {
  const authHeader = req.headers['authorization'];
  const ua = req.headers['user-agent'];

  if (authHeader?.startsWith('Bearer pkey_')) {
    const rawKey = authHeader.slice('Bearer '.length);
    const result = await apiKeys.verify(rawKey);
    if (result.isErr()) {
      return { ok: false, status: 401, reason: 'Invalid or revoked API key.' };
    }
    const principal = result.value;
    const workspace = await resolveWorkspace(workspaceSlug);
    if (!workspace || workspace.id !== principal.workspaceId) {
      return { ok: false, status: 401, reason: 'API key is not valid for this workspace.' };
    }
    return {
      ok: true,
      ctx: makeApiKeyContext(principal.keyId, principal.workspaceId, cid, req),
      principal,
    };
  }

  if (authHeader?.startsWith('Bearer ') && sessions) {
    const token = authHeader.slice('Bearer '.length);
    const sessionResult = await sessions.findByToken(token);
    if (sessionResult.isErr() || !sessionResult.value) {
      return { ok: false, status: 401, reason: 'Invalid or expired session token.' };
    }
    const session = sessionResult.value;
    if (session.expiresAt < new Date()) {
      return { ok: false, status: 401, reason: 'Session has expired.' };
    }
    const workspace = await resolveWorkspace(workspaceSlug);
    if (!workspace) {
      return { ok: false, status: 401, reason: `Workspace '${workspaceSlug}' not found.` };
    }
    if (session.workspaceId !== null && session.workspaceId !== workspace.id) {
      return { ok: false, status: 401, reason: 'Session is not valid for this workspace.' };
    }
    const ctx: RequestContext = {
      userId: session.userId,
      workspaceId: workspace.id,
      installationRoles: [],
      correlationId: cid,
      ipAddress: session.ipAddress ?? req.ip,
      ...(ua !== undefined ? { userAgent: ua } : {}),
      mfaSatisfied: false,
      _kind: 'user',
    };
    void sessions.touch(session.id).catch(() => undefined);
    return { ok: true, ctx, principal: null };
  }

  return { ok: false, status: 401, reason: 'Authentication required.' };
}

// ── GraphiQL playground HTML ───────────────────────────────────────────────────

function graphiqlHtml(endpoint: string, workspaceSlug: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GraphQL Playground</title>
  <style>body { margin: 0; height: 100vh; overflow: hidden; }</style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphiql@3/graphiql.min.css" />
</head>
<body>
<div id="graphiql" style="height:100vh;"></div>
<script crossorigin src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>
<script crossorigin src="https://cdn.jsdelivr.net/npm/graphiql@3/graphiql.min.js"></script>
<script>
(function() {
  var apiKey = localStorage.getItem('pf_api_key_${workspaceSlug}') || '';
  var fetcher = GraphiQL.createFetcher({
    url: '${endpoint}',
    headers: apiKey ? { Authorization: 'Bearer ' + apiKey } : {},
  });
  ReactDOM.createRoot(document.getElementById('graphiql')).render(
    React.createElement(GraphiQL, { fetcher: fetcher })
  );
})();
</script>
</body>
</html>`;
}

// ── Plugin ─────────────────────────────────────────────────────────────────────

const graphqlPlugin: FastifyPluginAsync<GraphQLPluginOptions> = async (
  fastify: FastifyInstance,
  opts: GraphQLPluginOptions,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const { handler, apiKeys, logger, resolveWorkspace, sessions } = opts;

  // Cache workspace resolution (same TTL as REST plugin)
  const workspaceCache = new Map<
    string,
    { value: { id: string; slug: string; name: string }; expiresAt: number }
  >();

  async function cachedResolveWorkspace(slug: string) {
    const entry = workspaceCache.get(slug);
    if (entry && Date.now() <= entry.expiresAt) return entry.value;
    const result = await resolveWorkspace(slug);
    if (result) workspaceCache.set(slug, { value: result, expiresAt: Date.now() + 60_000 });
    return result;
  }

  // ── GraphQL endpoint ───────────────────────────────────────────────────────

  type GQLParams = { workspaceSlug: string; schemaSlug: string };

  fastify.all<{ Params: GQLParams }>('/:schemaSlug/graphql', async (req, reply) => {
    const { workspaceSlug, schemaSlug } = req.params;
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
      return reply
        .status(authResult.status)
        .header('Content-Type', 'application/json')
        .header('X-Correlation-Id', cid)
        .send({
          errors: [
            {
              message: authResult.reason,
              extensions: { code: 'UNAUTHENTICATED', correlationId: cid },
            },
          ],
        });
    }

    // Parse the GraphQL request body
    let query = '';
    let variables: Record<string, unknown> | undefined;
    let operationName: string | undefined;

    const method = req.method.toUpperCase();
    if (method === 'GET') {
      const qs = req.query as Record<string, string>;
      query = qs['query'] ?? '';
      operationName = qs['operationName'];
      try {
        variables = qs['variables']
          ? (JSON.parse(qs['variables']) as Record<string, unknown>)
          : undefined;
      } catch {
        return reply.status(400).send({ errors: [{ message: 'Invalid variables JSON.' }] });
      }
    } else {
      const body = req.body as Record<string, unknown> | undefined;
      query = typeof body?.['query'] === 'string' ? body['query'] : '';
      variables =
        typeof body?.['variables'] === 'object' && body['variables'] !== null
          ? (body['variables'] as Record<string, unknown>)
          : undefined;
      operationName =
        typeof body?.['operationName'] === 'string' ? body['operationName'] : undefined;
    }

    if (!query) {
      return reply
        .status(400)
        .header('Content-Type', 'application/json')
        .send({
          errors: [
            {
              message: 'Missing "query" in GraphQL request.',
              extensions: { code: 'BAD_REQUEST', correlationId: cid },
            },
          ],
        });
    }

    const apiRequest: GraphQLApiRequest = {
      query,
      ctx: authResult.ctx,
      schemaSlug,
      workspaceSlug,
      ...(variables !== undefined ? { variables } : {}),
      ...(operationName !== undefined ? { operationName } : {}),
    };

    const response = await handler.handle(apiRequest);

    for (const [k, v] of Object.entries(response.headers ?? {})) {
      void reply.header(k, v);
    }
    void reply.header('X-Correlation-Id', cid);

    return reply.status(response.statusCode).send(response.body);
  });

  // ── GraphiQL playground page ───────────────────────────────────────────────

  fastify.get<{ Params: GQLParams }>('/:schemaSlug/graphql-playground', async (req, reply) => {
    const { workspaceSlug, schemaSlug } = req.params;
    const endpoint = `/${workspaceSlug}/${schemaSlug}/graphql`;
    const html = graphiqlHtml(endpoint, workspaceSlug);

    return reply
      .status(200)
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Cache-Control', 'no-store')
      .send(html);
  });

  logger.info('GraphQL routes registered');
};

export default graphqlPlugin;
