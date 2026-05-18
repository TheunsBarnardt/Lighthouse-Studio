/**
 * Server-side AuthService singleton for Next.js route handlers.
 * Uses in-memory adapters for development; replace via production composition root.
 */
/* eslint-disable no-restricted-syntax */
import type { AuthService } from '@platform/core';
import type { AuditPort } from '@platform/ports-audit';
import type {
  IdentityProviderPort,
  SessionPort,
  UserDirectoryPort,
} from '@platform/ports-identity';

// eslint-disable-next-line no-restricted-imports -- intentional dev-only composition: the web app pairs the in-memory identity provider + session adapter with a file-backed user directory (FileBackedUserDirectory) so password hashes survive restart. composeAuthMemory in @platform/composition uses InMemoryUserDirectory which has the bug fixed by ADR-0282; until a parallel composeAuthFileBacked lands in composition, we import the two ephemeral adapters here.
import {
  InMemoryIdentityProvider,
  InMemorySessionAdapter,
} from '@platform/adapter-identity-memory';
import { AuthService as CoreAuthService } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
} from '@platform/core/testing';

import { FileBackedUserDirectory } from './file-user-directory';

interface AuthBundle {
  authService: AuthService;
  identity: IdentityProviderPort;
  session: SessionPort;
  userDirectory: FileBackedUserDirectory;
}

interface ServerBundle {
  authBundle: AuthBundle;
  audit: AuditPort;
  /** User IDs granted installation-admin privileges in the current dev session. */
  installationAdmins: Set<string>;
}

// Derive the dep types from the CoreAuthService constructor so we don't need
// to import @platform/ports-authorization or @platform/ports-observability
// (which aren't direct deps of apps/web).
type AuthServiceCtorArgs = ConstructorParameters<typeof CoreAuthService>;
type AuthzDep = AuthServiceCtorArgs[3];
type AuditDep = AuthServiceCtorArgs[4];
type LoggerDep = AuthServiceCtorArgs[5];

function composeAuthFileBacked(deps: {
  authz: AuthzDep;
  audit: AuditDep;
  logger: LoggerDep;
}): AuthBundle {
  const identity = new InMemoryIdentityProvider();
  const session = new InMemorySessionAdapter();
  const userDirectory = new FileBackedUserDirectory();
  const authService = new CoreAuthService(
    identity,
    session,
    userDirectory,
    deps.authz,
    deps.audit,
    deps.logger,
  );
  return { authService, identity, session, userDirectory };
}

// Use globalThis so the singleton survives Next.js hot module replacement in dev mode
const g = globalThis as typeof globalThis & { _lighthouseServer?: ServerBundle };

function getServer(): ServerBundle {
  if (!g._lighthouseServer) {
    const audit = createInMemoryAudit();
    g._lighthouseServer = {
      authBundle: composeAuthFileBacked({
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
          return undefined;
        });
    }
  }
  return g._lighthouseServer;
}

function getBundle(): AuthBundle {
  return getServer().authBundle;
}

/** Persisted user IDs known to the directory — used for orphan-workspace recovery. */
export function getKnownUserIds(): Set<string> {
  return getBundle().userDirectory.allUserIds();
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
