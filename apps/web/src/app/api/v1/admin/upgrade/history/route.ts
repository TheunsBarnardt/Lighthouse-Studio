import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { getUpgradeHistory } from '@/lib/server/platform-version-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.' },
      { status: 401 },
    );
  }

  const history = getUpgradeHistory();

  return NextResponse.json({
    entries: history.map((v) => ({
      releaseVersion: v.releaseVersion,
      appliedAt: v.appliedAt.toISOString(),
      appliedBy: v.appliedBy ?? null,
      schemaMigrationHighWater: v.schemaMigrationHighWater ?? null,
      notes: v.notes ?? null,
    })),
  });
}
