import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getQueryConsoleAutocomplete } from '@/lib/server/query-console-service';

interface Params {
  workspaceId: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  const body = await req.json() as {
    schemaId?: string;
    queryText?: string;
    cursorPosition?: number;
    language?: string;
  };

  try {
    const items = await getQueryConsoleAutocomplete().suggest(
      ctx,
      params.workspaceId,
      body.schemaId ?? '',
      body.queryText ?? '',
      body.cursorPosition ?? 0,
      (body.language ?? 'sql_postgres') as 'sql_postgres' | 'sql_mssql' | 'mongo_aggregate' | 'mongo_find',
    );
    return okResponse({ items });
  } catch (e) {
    return errorResponse({ code: 'INTERNAL', message: String(e), statusCode: 500 } as never);
  }
}
