import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getIntentCaptureService } from '@/lib/server/intent-capture-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const categoryParam = url.searchParams.get('category');
  const result = await getIntentCaptureService().listTemplates(ctx, {
    limit: Number(url.searchParams.get('limit') ?? '20'),
    offset: Number(url.searchParams.get('offset') ?? '0'),
    ...(categoryParam !== null && { category: categoryParam }),
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}
