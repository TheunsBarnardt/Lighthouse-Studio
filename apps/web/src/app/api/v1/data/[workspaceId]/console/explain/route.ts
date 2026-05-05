import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getQueryConsoleService } from '@/lib/server/query-console-service';

interface Params {
  workspaceId: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  const body = (await req.json()) as {
    workspaceSlug?: string;
    databaseDriver?: string;
    query?: string;
    language?: string;
    parameters?: Record<string, unknown>;
  };

  const result = await getQueryConsoleService().explain(ctx, {
    workspaceId: params.workspaceId,
    workspaceSlug: body.workspaceSlug ?? '',
    databaseDriver: (body.databaseDriver ?? 'postgres') as 'postgres' | 'mssql' | 'mongo',
    query: body.query ?? '',
    language: (body.language ?? 'sql_postgres') as
      | 'sql_postgres'
      | 'sql_mssql'
      | 'mongo_aggregate'
      | 'mongo_find',
    ...(body.parameters !== undefined && { parameters: body.parameters }),
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}
