/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument --
   workspaces repo is cast to `any` in workspace-service to avoid importing the unbuilt
   ports-persistence package into the web app; all operations are structurally correct. */
import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { errorResponse, okResponse } from '@/lib/server/api-helpers';
import { getKnownUserIds } from '@/lib/server/auth-service';
import { verifySessionFromRequest } from '@/lib/server/session';
import {
  createOwnerMembership,
  getWorkspaceRepos,
  getWorkspaceService,
} from '@/lib/server/workspace-service';

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

/**
 * Workspace records round-trip through `.lighthouse-data/workspaces.json`, so
 * `createdAt` may arrive as a Date (freshly created in this process) or as an
 * ISO string (loaded from disk). Normalize before serializing the response.
 */
function asIso(value: Date | string | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

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
    // Before auto-provisioning a brand-new workspace, check if there are
    // *orphan* workspaces whose owner userId is not known to the user directory.
    // This happens when an earlier dev session created workspaces (file-backed)
    // but its users were in-memory and have since been wiped. We claim those
    // orphans for the current user so they aren't lost. See ADR-0282.
    const knownUserIds = getKnownUserIds();
    const allWorkspaces = await workspaces.findMany({});
    const allMembers = await members.findMany({});
    if (allWorkspaces.isOk() && allMembers.isOk()) {
      type WorkspaceRow = (typeof allWorkspaces.value.items)[number];
      type MemberRow = (typeof allMembers.value.items)[number];
      const orphanWorkspaces = allWorkspaces.value.items.filter(
        (ws: WorkspaceRow) => ws.archivedAt == null && !knownUserIds.has(ws.ownerUserId),
      );
      if (orphanWorkspaces.length > 0) {
        const adoptedItems: { id: string; name: string; slug: string; createdAt: string }[] = [];
        for (const ws of orphanWorkspaces) {
          // Reassign ownership on the workspace itself.
          await workspaces.update(ws.id, {
            ownerUserId: session.userId,
            updatedBy: session.userId,
            updatedAt: new Date(),
          });
          // Reassign membership records that pointed at the old owner.
          for (const m of allMembers.value.items as MemberRow[]) {
            if (m.workspaceId === ws.id && m.userId === ws.ownerUserId) {
              await members.update(m.id, { userId: session.userId, role: 'owner' });
            }
          }
          // If the workspace has no membership row at all for this user yet,
          // make sure one exists.
          const hasMember = (allMembers.value.items as MemberRow[]).some(
            (m) => m.workspaceId === ws.id && m.userId === session.userId,
          );
          if (!hasMember) {
            await createOwnerMembership(ws.id, session.userId);
          }
          adoptedItems.push({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            createdAt: asIso(ws.createdAt),
          });
        }
        return okResponse({ items: adoptedItems, adopted: adoptedItems.length });
      }
    }

    // No orphans to adopt — auto-provision a personal workspace for the user.
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
            createdAt: asIso(createResult.value.createdAt),
          },
        ],
      });
    }
  }

  // Fetch each workspace by its ID. findById returns archived rows too — we
  // must filter them out, otherwise a workspace the user just deleted will
  // reappear on the next list call (the membership row isn't archived on
  // delete, only the workspace itself is).
  const workspaceItems = [];
  for (const member of membersResult.value.items) {
    const wsResult = await workspaces.findById(member.workspaceId);
    if (wsResult.isOk() && wsResult.value) {
      const ws = wsResult.value;
      if (ws.archivedAt != null) continue;
      workspaceItems.push({
        id: ws.id,
        name: ws.name,
        slug: ws.slug,
        createdAt: asIso(ws.createdAt),
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
      createdAt: asIso(ws.createdAt),
    },
    201,
  );
}
