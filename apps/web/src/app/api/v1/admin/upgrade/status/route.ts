import type { NextRequest } from 'next/server';

import { PLATFORM_VERSION } from '@platform/core';
import { NextResponse } from 'next/server';

import { getDbVersionStatuses, isUpgradeInProgress } from '@/lib/server/platform-version-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.' },
      { status: 401 },
    );
  }

  const statuses = getDbVersionStatuses();

  return NextResponse.json({
    codeVersion: PLATFORM_VERSION,
    upgradeInProgress: isUpgradeInProgress(),
    dbs: statuses.map((s) => ({
      id: s.id,
      kind: s.kind,
      currentVersion: s.current?.releaseVersion ?? null,
      appliedAt: s.current?.appliedAt.toISOString() ?? null,
      appliedBy: s.current?.appliedBy ?? null,
      needsUpgrade: s.needsUpgrade,
    })),
  });
}
