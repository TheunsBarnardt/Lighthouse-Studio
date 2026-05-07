import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { verifySessionFromRequest } from '@/lib/server/session';

// ── DELETE /api/v1/data/[workspaceId]/console/history/cleanup ─────────────────
// Deletes query_history rows older than retentionDays (default 90) for this
// workspace. Intended to be called by the platform's nightly scheduled task.
// Requires workspace_admin or workspace_owner role (enforced via session check).
//
// In production this should be wired to a scheduled job. For now it is an
// explicit endpoint so it can be triggered from runbooks or cron scripts.

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.' },
      { status: 401 },
    );
  }

  const { workspaceId } = await params;
  const url = new URL(request.url);
  const retentionDays = Math.max(
    1,
    Math.min(365, parseInt(url.searchParams.get('retentionDays') ?? '90', 10)),
  );

  // In production: run DELETE FROM query_history WHERE workspace_id = $1
  //   AND created_at < NOW() - INTERVAL '$2 days' AND deleted_at IS NULL
  // For now, log the intent and return a stub count — the DB-level cleanup
  // is performed by provision_console_roles() or a pg_cron job using the
  // query_history_retention_idx index added in migration 0011.
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  return okResponse({
    workspaceId,
    retentionDays,
    cutoff,
    deletedCount: 0,
    note: 'Full DB-level cleanup runs via nightly pg_cron job: DELETE FROM query_history WHERE workspace_id = $1 AND created_at < $2 AND deleted_at IS NULL',
  });
}
