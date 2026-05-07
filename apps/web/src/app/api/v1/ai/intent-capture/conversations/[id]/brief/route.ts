import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getIntentCaptureService } from '@/lib/server/intent-capture-service';

interface Params {
  id: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const result = await getIntentCaptureService().getBriefDraft(ctx, params.id);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function POST(req: Request, { params }: { params: Params }) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const result = await getIntentCaptureService().generateBrief(ctx, params.id);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value, 201);
}
