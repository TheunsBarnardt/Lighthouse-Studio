import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const body = (await req.json()) as { fileIds: string[] };
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().bulkDelete(ctx, body.fileIds);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}
