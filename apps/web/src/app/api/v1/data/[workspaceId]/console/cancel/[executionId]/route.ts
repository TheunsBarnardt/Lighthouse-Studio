import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getQueryConsoleService } from '@/lib/server/query-console-service';

interface Params {
  workspaceId: string;
  executionId: string;
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  const result = await getQueryConsoleService().cancelExecution(
    ctx,
    params.executionId,
    params.workspaceId,
  );

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(null, 204);
}
