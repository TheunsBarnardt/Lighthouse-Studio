import type { Workspace } from '@platform/ports-authorization';

import { WorkspaceService } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
} from '@platform/core/testing';
import { uuidv7 } from 'uuidv7';

import { createFileRepo } from './file-repo';

type MemberEntity = {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument --
   file-repo satisfies RepositoryPort structurally but the web app cannot import the unbuilt
   ports-persistence package, so we cast to any and suppress the downstream unsafe-* rules. */
function buildBundle() {
  const workspaces = createFileRepo<Workspace>('workspaces') as any;
  const members = createFileRepo<MemberEntity>('workspace-members') as any;
  return {
    service: new WorkspaceService(
      createInMemoryAuthz(),
      workspaces,
      members,
      createInMemoryAudit(),
      createInMemoryLogger(),
    ),
    workspaces,
    members,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

type WorkspaceBundle = ReturnType<typeof buildBundle>;

// Use globalThis so workspace data survives Next.js hot module replacement in dev mode
const g = globalThis as typeof globalThis & { _lighthouseWorkspaces?: WorkspaceBundle };

function getBundle(): WorkspaceBundle {
  if (!g._lighthouseWorkspaces) {
    g._lighthouseWorkspaces = buildBundle();
  }
  return g._lighthouseWorkspaces;
}

export function getWorkspaceRepos() {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { workspaces, members } = getBundle();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  return { workspaces, members };
}

export function getWorkspaceService(): WorkspaceService {
  return getBundle().service;
}

export async function createOwnerMembership(workspaceId: string, userId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { members } = getBundle();
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  await members.create({
    id: uuidv7(),
    workspaceId,
    userId,
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    version: 1,
  });
}
