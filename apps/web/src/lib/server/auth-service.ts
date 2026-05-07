/**
 * Server-side AuthService singleton for Next.js route handlers.
 * Uses in-memory adapters for development; replace via production composition root.
 */
/* eslint-disable no-restricted-syntax */
import type { AuthService } from '@platform/core';
import type { AuditPort } from '@platform/ports-audit';
import type { SessionPort, UserDirectoryPort } from '@platform/ports-identity';

import { composeAuthMemory, type AuthMemoryBundle } from '@platform/composition';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
} from '@platform/core/testing';

interface ServerBundle {
  authBundle: AuthMemoryBundle;
  audit: AuditPort;
  /** User IDs granted installation-admin privileges in the current dev session. */
  installationAdmins: Set<string>;
}

// Use globalThis so the singleton survives Next.js hot module replacement in dev mode
const g = globalThis as typeof globalThis & { _lighthouseServer?: ServerBundle };

function getServer(): ServerBundle {
  if (!g._lighthouseServer) {
    const audit = createInMemoryAudit();
    g._lighthouseServer = {
      authBundle: composeAuthMemory({
        authz: createInMemoryAuthz(),
        audit,
        logger: createInMemoryLogger(),
      }),
      audit,
      installationAdmins: new Set<string>(),
    };
    // Seed a dev user from env so the state survives hot-reloads transparently.
    // The seed user is also granted installation_admin so the admin panel is accessible.
    const seedEmail = process.env['SEED_ADMIN_EMAIL'];
    if (seedEmail) {
      const server = g._lighthouseServer;
      const dir = server.authBundle.userDirectory;
      void dir
        .create({
          email: seedEmail,
          displayName: process.env['SEED_ADMIN_NAME'] ?? 'Admin',
          identity: {
            providerId: 'builtin',
            subject: seedEmail,
            email: seedEmail,
            emailVerified: true,
            primary: true,
          },
          preferences: {},
        })
        .then((result) => {
          if (result.isOk()) {
            server.installationAdmins.add(result.value.id);
          }
        });
    }
  }
  return g._lighthouseServer;
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

/** Returns true if the user has been granted installation_admin or installation_owner. */
export function isInstallationAdmin(userId: string): boolean {
  return getServer().installationAdmins.has(userId);
}

/** Grant installation_admin to a user (used by setup flow after first-run). */
export function grantInstallationAdmin(userId: string): void {
  getServer().installationAdmins.add(userId);
}
