import type { Result } from 'neverthrow';

import type { AuditError } from './errors.js';
import type { AuditEntry, AuditFilter, AuditPage, PaginatedAuditResult } from './types.js';

export interface AuditPort {
  write(entry: AuditEntry): Promise<Result<void, AuditError>>;
  query(filter: AuditFilter, page: AuditPage): Promise<Result<PaginatedAuditResult, AuditError>>;
}
