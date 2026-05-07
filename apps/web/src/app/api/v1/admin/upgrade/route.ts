import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { isInstallationAdmin } from '@/lib/server/auth-service';
import { isUpgradeInProgress, triggerUpgrade } from '@/lib/server/platform-version-service';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.' },
      { status: 401 },
    );
  }

  if (!isInstallationAdmin(session.userId)) {
    return NextResponse.json(
      { code: 'FORBIDDEN', message: 'Installation admin role required.' },
      { status: 403 },
    );
  }

  if (isUpgradeInProgress()) {
    return NextResponse.json(
      { code: 'CONFLICT', message: 'An upgrade is already in progress.' },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun === true;

  if (dryRun) {
    return NextResponse.json({ status: 'dry_run', message: 'Pre-flight checks passed.' });
  }

  void triggerUpgrade(session.userId);

  return NextResponse.json({ status: 'started', message: 'Upgrade started.' }, { status: 202 });
}
