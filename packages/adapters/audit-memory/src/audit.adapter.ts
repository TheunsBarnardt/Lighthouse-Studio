import type {
  AuditEntry,
  AuditError,
  AuditFilter,
  AuditPage,
  AuditPort,
  PaginatedAuditResult,
} from '@platform/ports-audit';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

export class InMemoryAuditPort implements AuditPort {
  private readonly log: AuditEntry[] = [];
  private nextId = 1;

  write(entry: AuditEntry): Promise<Result<void, AuditError>> {
    this.log.push({ ...entry, id: String(this.nextId++) });
    return Promise.resolve(ok(undefined));
  }

  query(filter: AuditFilter, page: AuditPage): Promise<Result<PaginatedAuditResult, AuditError>> {
    let items = this.log.filter((e) => {
      if (filter.workspaceId && e.workspaceId !== filter.workspaceId) return false;
      if (filter.actorId && e.actorId !== filter.actorId) return false;
      if (filter.action && e.action !== filter.action) return false;
      if (filter.resourceType && e.resourceType !== filter.resourceType) return false;
      if (filter.resourceId && e.resourceId !== filter.resourceId) return false;
      if (filter.from && e.occurredAt < filter.from) return false;
      if (filter.to && e.occurredAt > filter.to) return false;
      return true;
    });
    const total = items.length;
    items = items.slice(page.offset, page.offset + page.limit);
    return Promise.resolve(
      ok({ items: items.map((e) => ({ ...e })), total, limit: page.limit, offset: page.offset }),
    );
  }
}
