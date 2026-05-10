/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access --
   workspaces repo is cast to `any` in workspace-service to avoid importing the unbuilt
   ports-persistence package into the web app; all operations are structurally correct. */
import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { errorResponse } from '@/lib/server/api-helpers';
import { verifySessionFromRequest } from '@/lib/server/session';
import { getWorkspaceRepos, getWorkspaceService } from '@/lib/server/workspace-service';

type RouteParams = { params: Promise<{ slug: string }> };

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const { slug: idOrSlug } = await params;
  const { workspaces } = getWorkspaceRepos();

  // Try by ID first (fast path used by the UI), fall back to slug scan
  const byIdResult = await workspaces.findById(idOrSlug);
  if (byIdResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL', message: 'Failed to look up workspace.', statusCode: 500 },
      { status: 500 },
    );
  }

  let workspace = byIdResult.value;

  if (!workspace) {
    const bySlugResult = await workspaces.findOne({ slug: { _eq: idOrSlug } });
    if (bySlugResult.isErr()) {
      return NextResponse.json(
        { code: 'INTERNAL', message: 'Failed to look up workspace.', statusCode: 500 },
        { status: 500 },
      );
    }
    workspace = bySlugResult.value;
  }

  if (!workspace) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Workspace not found.', statusCode: 404 },
      { status: 404 },
    );
  }

  const ctx = {
    _kind: 'user' as const,
    userId: session.userId,
    workspaceId: workspace.id as string,
    installationRoles: [],
    correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
    mfaSatisfied: false,
  };

  const service = getWorkspaceService();
  const result = await service.delete(ctx, workspace.id as string);
  if (result.isErr()) return errorResponse(result.error);

  return new NextResponse(null, { status: 204 });
}
