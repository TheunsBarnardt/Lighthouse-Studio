import {
  ApprovalRoutingEngine,
  QueryClassifierImpl,
  QueryConsoleAutocomplete,
  QueryConsoleService,
  SchemaService,
} from '@platform/core';
import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryDdl,
  createInMemoryIntrospection,
  createInMemoryLogger,
  createInMemoryMigration,
  createInMemoryRepo,
} from '@platform/core/testing';

// In-memory stub executor satisfies RawQueryPort for dev/test environments.
// Production wires a real PostgresRawQueryAdapter / MssqlRawQueryAdapter / MongoRawQueryAdapter.
const NOT_IMPLEMENTED = {
  isOk: () => false,
  isErr: () => true,
  error: { code: 'NOT_IMPLEMENTED', message: 'Raw query executor not wired in this environment' },
} as never;

const stubExecutor = {
  execute(): Promise<never> {
    return Promise.resolve(NOT_IMPLEMENTED);
  },
  explain(): Promise<never> {
    return Promise.resolve(NOT_IMPLEMENTED);
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
      new ApprovalRoutingEngine(),
    );
    _autocomplete = new QueryConsoleAutocomplete(schemaService);
  }
  return _autocomplete;
}
