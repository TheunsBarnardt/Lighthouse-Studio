import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
  fileId: string;
}

export async function POST(req: Request, { params }: { params: Params }) {
  const body = (await req.json()) as {
    ttlSeconds?: number;
    downloadLimit?: number;
    description?: string;
    directMode?: boolean;
  };
  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().createSignedUrl(ctx, params.fileId, {
    ...(body.ttlSeconds !== undefined ? { ttlSeconds: body.ttlSeconds } : {}),
    ...(body.downloadLimit !== undefined ? { downloadLimit: body.downloadLimit } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.directMode !== undefined ? { directMode: body.directMode } : {}),
  });
  if (result.isErr()) return errorResponse(result.error);
  const record = result.value;
  const signedUrlBase = new URL(req.url).origin;
  return okResponse({
    ...record,
    url: `${signedUrlBase}/api/v1/storage/resolve/${record.token}`,
  });
}
