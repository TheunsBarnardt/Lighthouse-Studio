import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort } from '@platform/ports-authorization';
import type {
  IdentityProviderPort,
  SessionPort,
  UserDirectoryPort,
} from '@platform/ports-identity';
import type { LoggerPort } from '@platform/ports-observability';

import {
  InMemoryIdentityProvider,
  InMemorySessionAdapter,
  InMemoryUserDirectory,
} from '@platform/adapter-identity-memory';
import { AuthService } from '@platform/core';

export interface AuthMemoryBundle {
  readonly authService: AuthService;
  readonly identity: IdentityProviderPort;
  readonly session: SessionPort;
  readonly userDirectory: UserDirectoryPort;
}

export interface AuthMemoryDeps {
  readonly authz: AuthorizationPort;
  readonly audit: AuditPort;
  readonly logger: LoggerPort;
}

export function composeAuthMemory(deps: AuthMemoryDeps): AuthMemoryBundle {
  const identity = new InMemoryIdentityProvider();
  const session = new InMemorySessionAdapter();
  const userDirectory = new InMemoryUserDirectory();
  const authService = new AuthService(
    identity,
    session,
    userDirectory,
    deps.authz,
    deps.audit,
    deps.logger,
  );
  return { authService, identity, session, userDirectory };
}
