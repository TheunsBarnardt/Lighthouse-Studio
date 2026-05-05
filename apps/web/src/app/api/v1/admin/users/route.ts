/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- in-memory adapter types unresolved until packages rebuilt */
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

  const directory = getUserDirectory();
  let result;
  try {
    result = await directory.search({ query, page, limit });
  } catch {
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to search users', statusCode: 500 },
      { status: 500 },
    );
  }

  return okResponse({
    items:
      result.items?.map((u) => ({
        id: u.id,
        email: u.primaryEmail || u.email,
        displayName: u.displayName || null,
        status: u.status,
        mfaEnabled: u.mfaEnabled || false,
        createdAt: u.createdAt,
      })) || [],
    total: result.total || 0,
    page,
    limit,
  });
}
