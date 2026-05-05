import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().getQuota(ctx);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}
