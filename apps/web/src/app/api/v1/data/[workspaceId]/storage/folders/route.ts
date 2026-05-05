import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const body = (await req.json()) as { bucketId: string; path: string };
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().createFolder(ctx, body.bucketId, body.path);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse({ ok: true }, 201);
}
