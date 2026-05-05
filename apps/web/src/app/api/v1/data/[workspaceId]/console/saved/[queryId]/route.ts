import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getQueryConsoleService } from '@/lib/server/query-console-service';

interface Params {
  workspaceId: string;
  queryId: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  const result = await getQueryConsoleService().getSavedQuery(ctx, params.queryId, params.workspaceId);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function PUT(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  const body = await req.json() as {
    version?: number;
    name?: string;
    description?: string;
    queryText?: string;
    queryLanguage?: string;
    defaultParameters?: Record<string, unknown>;
    folderPath?: string;
    shared?: boolean;
    sharedCanRun?: boolean;
  };

  const result = await getQueryConsoleService().updateSavedQuery(ctx, {
    id: params.queryId,
    version: body.version ?? 1,
    workspaceId: params.workspaceId,
    name: body.name,
    description: body.description,
    queryText: body.queryText,
    queryLanguage: body.queryLanguage as 'sql_postgres' | 'sql_mssql' | 'mongo_aggregate' | 'mongo_find' | undefined,
    defaultParameters: body.defaultParameters,
    folderPath: body.folderPath,
    shared: body.shared,
    sharedCanRun: body.sharedCanRun,
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  const result = await getQueryConsoleService().deleteSavedQuery(ctx, params.queryId, params.workspaceId);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(null, 204);
}
