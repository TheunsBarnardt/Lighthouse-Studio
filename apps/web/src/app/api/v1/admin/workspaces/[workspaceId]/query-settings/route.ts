import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { verifySessionFromRequest } from '@/lib/server/session';

// ── In-memory store for per-workspace query console settings ─────────────────
// Production would persist these in a workspace_settings table.
// Stored as { defaultRowLimit, defaultTimeoutMs }; falls back to platform defaults.

const PLATFORM_ROW_LIMIT_DEFAULT = 1_000;
const PLATFORM_TIMEOUT_MS_DEFAULT = 30_000;
const MAX_ROW_LIMIT = 100_000;
const MAX_TIMEOUT_MS = 300_000;

interface WorkspaceQuerySettings {
  defaultRowLimit: number;
  defaultTimeoutMs: number;
}

const _store = new Map<string, WorkspaceQuerySettings>();

function getSettings(workspaceId: string): WorkspaceQuerySettings {
  return (
    _store.get(workspaceId) ?? {
      defaultRowLimit: PLATFORM_ROW_LIMIT_DEFAULT,
      defaultTimeoutMs: PLATFORM_TIMEOUT_MS_DEFAULT,
    }
  );
}

// ── GET /api/v1/admin/workspaces/[workspaceId]/query-settings ─────────────────

export async function GET(
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
  return okResponse(getSettings(workspaceId));
}

// ── PATCH /api/v1/admin/workspaces/[workspaceId]/query-settings ──────────────

export async function PATCH(
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
  const body = (await request.json()) as Partial<WorkspaceQuerySettings>;

  const current = getSettings(workspaceId);

  const next: WorkspaceQuerySettings = {
    defaultRowLimit:
      body.defaultRowLimit !== undefined
        ? Math.max(1, Math.min(MAX_ROW_LIMIT, Math.floor(body.defaultRowLimit)))
        : current.defaultRowLimit,
    defaultTimeoutMs:
      body.defaultTimeoutMs !== undefined
        ? Math.max(1_000, Math.min(MAX_TIMEOUT_MS, Math.floor(body.defaultTimeoutMs)))
        : current.defaultTimeoutMs,
  };

  _store.set(workspaceId, next);
  return okResponse(next);
}
