/**
 * Server-side AuthService singleton for Next.js route handlers.
 * Uses in-memory adapters for development; replace via production composition root.
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
import type { AuditPort } from '@platform/ports-audit';
import type { SessionPort, UserDirectoryPort } from '@platform/ports-identity';

import { AuthService } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
} from '@platform/core/testing';
import { composeAuthMemory, type AuthMemoryBundle } from '@platform/composition';

interface ServerBundle {
  authBundle: AuthMemoryBundle;
  audit: AuditPort;
}

let _server: ServerBundle | null = null;

function getServer(): ServerBundle {
  if (!_server) {
    const audit = createInMemoryAudit();
    _server = {
      authBundle: composeAuthMemory({
        authz: createInMemoryAuthz(),
        audit,
        logger: createInMemoryLogger(),
      }),
      audit,
    };
  }
  return _server;
}

function getBundle(): AuthMemoryBundle {
  return getServer().authBundle;
}

export function getAuditAdapter(): AuditPort {
  return getServer().audit;
}

export function getAuthService(): AuthService {
  return getBundle().authService;
}

export function getSessionAdapter(): SessionPort {
  return getBundle().session;
}

export function getUserDirectory(): UserDirectoryPort {
  return getBundle().userDirectory;
}
