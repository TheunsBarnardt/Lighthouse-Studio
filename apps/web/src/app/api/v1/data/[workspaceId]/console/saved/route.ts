import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getQueryConsoleService } from '@/lib/server/query-console-service';

interface Params {
  workspaceId: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);
  const url = new URL(req.url);

  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
  const offset = Number(url.searchParams.get('offset') ?? '0');
  const includeShared = url.searchParams.get('includeShared') === 'true';
  const folderPath = url.searchParams.get('folderPath') ?? undefined;

  const result = await getQueryConsoleService().listSavedQueries(ctx, {
    workspaceId: params.workspaceId,
    includeShared,
    folderPath,
    limit,
    offset,
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function POST(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  const body = await req.json() as {
    name?: string;
    description?: string;
    queryText?: string;
    queryLanguage?: string;
    defaultParameters?: Record<string, unknown>;
    folderPath?: string;
    shared?: boolean;
    sharedCanRun?: boolean;
  };

  const result = await getQueryConsoleService().saveQuery(ctx, {
    workspaceId: params.workspaceId,
    name: body.name ?? '',
    description: body.description,
    queryText: body.queryText ?? '',
    queryLanguage: (body.queryLanguage ?? 'sql_postgres') as 'sql_postgres' | 'sql_mssql' | 'mongo_aggregate' | 'mongo_find',
    defaultParameters: body.defaultParameters,
    folderPath: body.folderPath,
    shared: body.shared,
    sharedCanRun: body.sharedCanRun,
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value, 201);
}
