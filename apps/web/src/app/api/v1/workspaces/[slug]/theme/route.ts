import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { verifySessionFromRequest } from '@/lib/server/session';
import {
  ThemeValidationError,
  ThemeVersionConflictError,
  getWorkspaceTheme,
  updateWorkspaceTheme,
} from '@/lib/server/workspace-theme-service';
import { WorkspaceThemeSchema } from '@/lib/theme/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.' }, { status: 401 });
  }
  const { slug } = await params;
  return okResponse(getWorkspaceTheme(slug));
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.' }, { status: 401 });
  }
  const { slug } = await params;

  const raw = (await request.json()) as unknown;
  const parsed = WorkspaceThemeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION_ERROR', message: 'Invalid theme payload', metadata: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const next = updateWorkspaceTheme({
      workspaceId: slug,
      expectedVersion: parsed.data.version,
      next: parsed.data,
      user: session.userId,
    });
    return okResponse(next);
  } catch (e) {
    if (e instanceof ThemeVersionConflictError) {
      return NextResponse.json(
        { code: 'VERSION_CONFLICT', message: 'Theme was modified by another writer.', metadata: { current: e.current } },
        { status: 409 },
      );
    }
    if (e instanceof ThemeValidationError) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Invalid theme', metadata: e.issues },
        { status: 400 },
      );
    }
    throw e;
  }
}
