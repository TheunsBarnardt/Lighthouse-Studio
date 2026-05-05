import { QueryClassifierImpl, QueryConsoleAutocomplete, QueryConsoleService } from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryDdl,
  createInMemoryIntrospection,
  createInMemoryLogger,
  createInMemoryMigration,
  createInMemoryRepo,
} from '@platform/core/testing';
import { SchemaService } from '@platform/core';
import type { ApprovalsRoutingEnginePort } from '@platform/ports-approvals';

// Minimal stub for ApprovalRoutingEngine (not needed in console context)
const stubApprovals: ApprovalsRoutingEnginePort = {
  async route() { return { isOk: () => true, isErr: () => false, value: [] } as never; },
};

// In-memory stub executor satisfies RawQueryPort for dev/test environments.
// Production wires a real PostgresRawQueryAdapter / MssqlRawQueryAdapter / MongoRawQueryAdapter.
const stubExecutor = {
  async execute() {
    return { isOk: () => false, isErr: () => true, error: { code: 'NOT_IMPLEMENTED', message: 'Raw query executor not wired in this environment' } } as never;
  },
  async explain() {
    return { isOk: () => false, isErr: () => true, error: { code: 'NOT_IMPLEMENTED', message: 'Raw query executor not wired in this environment' } } as never;
  },
};

let _service: QueryConsoleService | null = null;
let _autocomplete: QueryConsoleAutocomplete | null = null;

export function getQueryConsoleService(): QueryConsoleService {
  if (!_service) {
    _service = new QueryConsoleService(
      createInMemoryAuthz(),
      new QueryClassifierImpl(),
      stubExecutor,
      createInMemoryRepo(),
      createInMemoryRepo(),
      createInMemoryAudit(),
      createInMemoryLogger(),
    );
  }
  return _service;
}

export function getQueryConsoleAutocomplete(): QueryConsoleAutocomplete {
  if (!_autocomplete) {
    const schemaService = new SchemaService(
      createInMemoryAuthz(),
      createInMemoryRepo(),
      createInMemoryRepo(),
      createInMemoryIntrospection(),
      createInMemoryDdl(),
      createInMemoryMigration(),
      createInMemoryAudit(),
      createInMemoryLogger(),
      stubApprovals,
    );
    _autocomplete = new QueryConsoleAutocomplete(schemaService);
  }
  return _autocomplete;
}
