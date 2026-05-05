import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { verifySessionFromRequest } from '@/lib/server/session';
import { okResponse } from '@/lib/server/api-helpers';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: WorkspaceService.listAll(ctx) — requires installation:owner role
  return okResponse({ items: [] });
}
