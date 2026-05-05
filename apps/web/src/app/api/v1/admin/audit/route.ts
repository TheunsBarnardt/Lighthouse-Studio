import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { verifySessionFromRequest } from '@/lib/server/session';
import { okResponse } from '@/lib/server/api-helpers';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100);
  const actorId = url.searchParams.get('actorId') ?? undefined;
  const eventType = url.searchParams.get('eventType') ?? undefined;

  // TODO: AuditService.list({ page, limit, actorId, eventType })
  return okResponse({ items: [], total: 0, page, limit, actorId, eventType });
}
