import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
  fileId: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);

  // Get the file record to generate a temporary preview URL via a signed URL
  const fileResult = await getStorageService().getFile(ctx, params.fileId);
  if (fileResult.isErr()) return errorResponse(fileResult.error);

  // Create a short-lived signed URL (5 min) for preview
  const signedResult = await getStorageService().createSignedUrl(ctx, params.fileId, {
    ttlSeconds: 300,
    description: 'preview',
  });
  if (signedResult.isErr()) return errorResponse(signedResult.error);

  const origin = new URL(req.url).origin;
  return okResponse({ url: `${origin}/api/v1/storage/resolve/${signedResult.value.token}` });
}
