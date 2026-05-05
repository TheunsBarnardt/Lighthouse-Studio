import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';
import type { FileRecord, StorageQuota } from '@platform/ports-storage';

// Drift threshold: reconcile if actual vs. recorded usage differs by more than 10 MiB
const DRIFT_THRESHOLD_BYTES = 10 * 1024 * 1024;

type FileRecordRepo = RepositoryPort<FileRecord>;
type QuotaRepo = RepositoryPort<StorageQuota>;

export class StorageReconciliationJob {
  constructor(
    private readonly fileRecords: FileRecordRepo,
    private readonly quotas: QuotaRepo,
    private readonly logger: LoggerPort,
    private readonly metrics?: MetricsPort,
  ) {}

  /**
   * Run reconciliation for all workspaces that have a quota record.
   * Returns the number of workspaces whose quota was corrected.
   */
  async run(): Promise<number> {
    this.logger.info('StorageReconciliationJob.start', {});

    const quotasResult = await this.quotas.findMany();
    if (quotasResult.isErr()) {
      this.logger.error('StorageReconciliationJob.quota_list_failed', {
        error: quotasResult.error.message,
      });
      return 0;
    }

    let corrected = 0;
    for (const quota of quotasResult.value.items) {
      const drift = await this._reconcileWorkspace(quota);
      if (drift !== 0) corrected++;
    }

    this.logger.info('StorageReconciliationJob.complete', { corrected });
    return corrected;
  }

  private async _reconcileWorkspace(quota: StorageQuota): Promise<number> {
    // Sum actual file sizes in the workspace
    const filesResult = await this.fileRecords.findMany({
      filter: { workspaceId: { _eq: quota.workspaceId } } as Parameters<
        FileRecordRepo['findMany']
      >[0],
    } as Parameters<FileRecordRepo['findMany']>[0]);

    if (filesResult.isErr()) {
      this.logger.error('StorageReconciliationJob.file_list_failed', {
        workspaceId: quota.workspaceId,
        error: filesResult.error.message,
      });
      return 0;
    }

    const actualBytes = filesResult.value.items.reduce((sum, f) => sum + f.sizeBytes, 0);
    const drift = Math.abs(actualBytes - quota.usedBytes);

    if (drift <= DRIFT_THRESHOLD_BYTES) return 0;

    this.logger.warn('StorageReconciliationJob.drift_detected', {
      workspaceId: quota.workspaceId,
      recorded: quota.usedBytes,
      actual: actualBytes,
      drift,
    });

    await this.quotas.update(quota.id, {
      ...quota,
      usedBytes: actualBytes,
      lastReconciledAt: new Date(),
      updatedAt: new Date(),
    });

    this.metrics
      ?.counter('platform_storage_orphans_detected_total', {
        description: 'Storage quota drifts detected and corrected during reconciliation',
      })
      .add(1);

    this.metrics
      ?.gauge('platform_storage_bytes_used', { description: 'Storage bytes used per workspace' })
      .set(actualBytes, { workspace: quota.workspaceId });

    return drift;
  }
}
