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

/**
 * Register the storage reconciliation job with the scheduler and job queue.
 * Call once at application startup after the scheduler has started.
 *
 * The job runs nightly at 02:00 UTC and corrects quota drift > 10 MiB.
 */
export async function registerStorageJobs(
  c: PlatformContainer,
  reconciliationJob: StorageReconciliationJob,
): Promise<void> {
  const QUEUE = 'storage';
  const TYPE = 'reconcile';

  // Register the execution handler on the job queue
  c.jobs.register(QUEUE, TYPE, async () => {
    const corrected = await reconciliationJob.run();
    c.logger.info('Storage reconciliation complete', { corrected });
  });

  // Schedule a nightly cron (02:00 UTC) via the scheduler port if present
  if (c.scheduler) {
    await c.scheduler.register({
      id: 'storage-reconciliation',
      name: 'Storage Quota Reconciliation',
      cron: '0 2 * * *',
      queue: QUEUE,
      type: TYPE,
      payload: {},
      enabled: true,
    });
  }
}
