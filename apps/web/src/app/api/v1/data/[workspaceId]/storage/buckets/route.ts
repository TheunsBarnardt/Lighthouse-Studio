import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().listBuckets(ctx);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function POST(req: Request, { params }: { params: Params }) {
  const body: unknown = await req.json();
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().createBucket(ctx, body as never);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value, 201);
}
