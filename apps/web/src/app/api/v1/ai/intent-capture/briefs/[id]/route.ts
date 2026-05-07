import type { BriefEdit } from '@platform/core';

import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getIntentCaptureService } from '@/lib/server/intent-capture-service';

interface Params {
  id: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const result = await getIntentCaptureService().getConversation(ctx, params.id);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId') ?? '';
  const ctx = requestContext(workspaceId, req);

  const body = (await req.json()) as BriefEdit;

  const result = await getIntentCaptureService().editBrief(ctx, params.id, body);
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}
