import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
  urlId: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().revokeSignedUrl(ctx, params.urlId);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse({ ok: true });
}
