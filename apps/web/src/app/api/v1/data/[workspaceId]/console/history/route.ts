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

  const result = await getQueryConsoleService().listHistory(ctx, {
    workspaceId: params.workspaceId,
    limit,
    offset,
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}
