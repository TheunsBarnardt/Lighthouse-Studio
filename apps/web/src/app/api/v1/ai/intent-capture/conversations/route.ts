import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getIntentCaptureService } from '@/lib/server/intent-capture-service';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const result = await getIntentCaptureService().listConversations(ctx, {
    limit: Number(url.searchParams.get('limit') ?? '20'),
    offset: Number(url.searchParams.get('offset') ?? '0'),
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const body = (await req.json()) as { templateId?: string };

  const result = await getIntentCaptureService().startConversation(ctx, {
    ...(body.templateId !== undefined && { templateId: body.templateId }),
  });

  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value, 201);
}
