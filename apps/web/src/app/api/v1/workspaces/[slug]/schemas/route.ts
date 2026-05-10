import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  await params; // consume params — slug/workspaceId not needed for empty stub

  // TODO: wire up SchemaService once the composition root is ready
  return okResponse({ items: [], total: 0, hasNextPage: false, nextCursor: null });
}
