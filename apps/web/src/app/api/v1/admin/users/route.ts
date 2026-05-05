import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { getUserDirectory } from '@/lib/server/auth-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const page = Number(url.searchParams.get('page') ?? '1');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '20'), 100);
  const offset = (page - 1) * limit;

  const directory = getUserDirectory();
  const searchResult = await directory.search({ query, limit, offset });
  if (searchResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to search users', statusCode: 500 },
      { status: 500 },
    );
  }

  const { items, total } = searchResult.value;
  return okResponse({
    items: items.map((u) => ({
      id: u.id,
      email: u.primaryEmail,
      displayName: u.displayName,
      status: u.status,
      mfaEnabled: u.mfaEnabled,
      createdAt: u.createdAt,
    })),
    total,
    page,
    limit,
  });
}
