import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { errorResponse, okResponse } from '@/lib/server/api-helpers';
import {
  createOwnerMembership,
  getWorkspaceRepos,
  getWorkspaceService,
} from '@/lib/server/workspace-service';
import { verifySessionFromRequest } from '@/lib/server/session';

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  const { workspaces, members } = getWorkspaceRepos();

  // Find all workspaces where the user is a member
  const membersResult = await members.findMany({
    filter: { userId: { _eq: session.userId } },
  });
  if (membersResult.isErr()) {
    return NextResponse.json(
      { code: 'INTERNAL', message: 'Failed to list workspaces.', statusCode: 500 },
      { status: 500 },
    );
  }

  const memberRecords = membersResult.value.items;

  if (memberRecords.length === 0) {
    // Auto-provision a personal workspace for the user
    const service = getWorkspaceService();
    const ctx = {
      _kind: 'user' as const,
      userId: session.userId,
      workspaceId: '',
      installationRoles: [],
      correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
      mfaSatisfied: false,
    };
    const slug = `workspace-${session.userId.slice(0, 8)}`;
    const createResult = await service.create(ctx, { name: 'My Workspace', slug });
    if (createResult.isErr()) {
      // If slug conflict on auto-provision, try to list again (race condition)
      const retryResult = await members.findMany({
        filter: { userId: { _eq: session.userId } },
      });
      if (retryResult.isOk() && retryResult.value.items.length > 0) {
        // fall through to fetch workspaces below
      } else {
        return errorResponse(createResult.error);
      }
    } else {
      await createOwnerMembership(createResult.value.id, session.userId);
      return okResponse({
        items: [
          {
            id: createResult.value.id,
            name: createResult.value.name,
            slug: createResult.value.slug,
            createdAt: createResult.value.createdAt.toISOString(),
          },
        ],
      });
    }
  }

  // Fetch each workspace by its ID
  const workspaceItems = [];
  for (const member of membersResult.value.items) {
    const wsResult = await workspaces.findById(member.workspaceId);
    if (wsResult.isOk() && wsResult.value) {
      const ws = wsResult.value;
      workspaceItems.push({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        createdAt: ws.createdAt.toISOString(),
      });
    }
  }

  return okResponse({ items: workspaceItems });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 },
      { status: 400 },
    );
  }

  const parsed = CreateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid input', statusCode: 400 },
      { status: 400 },
    );
  }

  const ctx = {
    _kind: 'user' as const,
    userId: session.userId,
    workspaceId: '',
    installationRoles: [],
    correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
    mfaSatisfied: false,
  };

  const service = getWorkspaceService();
  const result = await service.create(ctx, parsed.data);
  if (result.isErr()) return errorResponse(result.error);

  await createOwnerMembership(result.value.id, session.userId);

  const ws = result.value;
  return okResponse(
    {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      createdAt: ws.createdAt.toISOString(),
    },
    201,
  );
}
