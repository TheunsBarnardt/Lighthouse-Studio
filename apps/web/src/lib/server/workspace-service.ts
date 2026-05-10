import type { Workspace } from '@platform/ports-authorization';

import { WorkspaceService } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryRepo,
} from '@platform/core/testing';
import { uuidv7 } from 'uuidv7';

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

function buildBundle() {
  const workspaces = createInMemoryRepo<Workspace>();
  const members = createInMemoryRepo<MemberEntity>();
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
  const { workspaces, members } = getBundle();
  return { workspaces, members };
}

export function getWorkspaceService(): WorkspaceService {
  return getBundle().service;
}

export async function createOwnerMembership(workspaceId: string, userId: string): Promise<void> {
  const { members } = getBundle();
  const now = new Date().toISOString();
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
