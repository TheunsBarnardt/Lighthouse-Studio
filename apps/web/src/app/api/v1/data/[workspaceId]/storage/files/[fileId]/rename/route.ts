import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
  fileId: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const body = (await req.json()) as { newName: string };
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().renameFile(ctx, params.fileId, body.newName);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}
