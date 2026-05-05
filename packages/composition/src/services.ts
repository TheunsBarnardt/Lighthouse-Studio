/**
 * Service factory helpers.
 * Each function wires a domain service from the adapters in a PlatformContainer.
 */
import { StorageReconciliationJob, StorageService } from '@platform/core';

import type { PlatformContainer } from './container.js';

export function createStorageService(c: PlatformContainer): StorageService {
  return new StorageService(
    // Authorization is not in PlatformContainer; use a passthrough stub for now.
    // In production, wire the real RBAC authz adapter here.
    { authorize: () => Promise.resolve({ isErr: () => false, isOk: () => true }) } as never,
    c.storage,
    c.persistence.repository('storage_buckets'),
    c.persistence.repository('file_records'),
    c.persistence.repository('file_acls'),
    c.persistence.repository('signed_urls'),
    c.persistence.repository('storage_quotas'),
    c.audit,
    c.logger,
    c.eventBus,
    c.metrics,
  );
}

export function createStorageReconciliationJob(c: PlatformContainer): StorageReconciliationJob {
  return new StorageReconciliationJob(
    c.persistence.repository('file_records'),
    c.persistence.repository('storage_quotas'),
    c.logger,
    c.metrics,
  );
}
