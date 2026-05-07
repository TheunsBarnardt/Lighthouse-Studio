import type { MigrationPlan, MigrationExecution, BatchResult, RowError, ToleranceMode } from './types.js';
import { TransformationEngine } from './transformation-engine.js';

export interface ExecutorDeps {
  getExecution(id: string): Promise<MigrationExecution | null>;
  updateExecution(id: string, update: Partial<MigrationExecution>): Promise<void>;
  getPlan(id: string): Promise<MigrationPlan | null>;
  streamSourceRows(sourceConnectionId: string, tableId: string, batchSize: number): AsyncIterable<Record<string, unknown>[]>;
  bulkInsertRows(targetTableId: string, rows: Record<string, unknown>[]): Promise<{ inserted: number; errors: Array<{ index: number; error: string }> }>;
  takeSnapshot(workspaceId: string, tableIds: string[]): Promise<string>;
  restoreSnapshot(snapshotId: string): Promise<void>;
  checkRowCount(tableId: string): Promise<number>;
  checkFkIntegrity(tableId: string): Promise<{ violations: number }>;
  checkTruncation(tableId: string): Promise<{ truncated: string[] }>;
  emitProgress(executionId: string, migratedRows: number, totalRows: number): void;
}

const DEFAULT_BATCH_ERROR_THRESHOLD = 0.05;

export class MigrationExecutor {
  private readonly engine = new TransformationEngine();

  constructor(private readonly deps: ExecutorDeps) {}

  async execute(executionId: string, workspaceId: string): Promise<void> {
    const execution = await this.deps.getExecution(executionId);
    if (!execution) throw new Error(`Execution ${executionId} not found`);

    const plan = await this.deps.getPlan(execution.planId);
    if (!plan) throw new Error(`Plan ${execution.planId} not found`);

    const toleranceMode: ToleranceMode = plan.toleranceMode;
    const batchSize = plan.batchSize;
    const batchErrorThreshold = DEFAULT_BATCH_ERROR_THRESHOLD;

    // Take snapshot
    await this.deps.updateExecution(executionId, { status: 'snapshotting' });
    const targetTableIds = plan.tableMappings.map(m => m.targetTableId);
    const snapshotId = await this.deps.takeSnapshot(workspaceId, targetTableIds);
    await this.deps.updateExecution(executionId, { snapshotId, status: 'running' });

    let totalMigrated = 0;
    let totalFailed = 0;
    const allBatchResults: BatchResult[] = [];

    try {
      for (const tableMapping of plan.tableMappings) {
        let batchIndex = execution.currentBatchIndex;

        for await (const batch of this._batchedStream(plan.sourceConnectionId, tableMapping.sourceTableId, batchSize, batchIndex)) {
          const batchResult = await this._processBatch(batch, tableMapping, batchIndex, plan);
          allBatchResults.push(batchResult);
          totalMigrated += batchResult.rowsSucceeded;
          totalFailed += batchResult.rowsFailed;

          await this.deps.updateExecution(executionId, {
            migratedRows: totalMigrated,
            failedRows: totalFailed,
            currentBatchIndex: batchIndex + 1,
            currentTableId: tableMapping.targetTableId,
            batchResults: allBatchResults,
          });

          this.deps.emitProgress(executionId, totalMigrated, execution.totalRows);

          if (toleranceMode === 'fail_on_first_error' && batchResult.rowsFailed > 0) {
            throw new Error(`Row failed in fail-on-first-error mode: ${batchResult.errors[0]?.error}`);
          }

          if (toleranceMode === 'fail_on_batch_error') {
            const errorRate = batchResult.rowsAttempted > 0 ? batchResult.rowsFailed / batchResult.rowsAttempted : 0;
            if (errorRate > batchErrorThreshold) {
              throw new Error(`Batch ${batchIndex} error rate ${(errorRate * 100).toFixed(1)}% exceeds ${(batchErrorThreshold * 100).toFixed(0)}% threshold`);
            }
          }

          batchIndex++;
        }
      }

      // Validation
      await this.deps.updateExecution(executionId, { status: 'validating' });
      await this._validate(executionId, plan, totalMigrated);

      await this.deps.updateExecution(executionId, {
        status: 'completed',
        completedAt: new Date(),
        migratedRows: totalMigrated,
        failedRows: totalFailed,
      });
    } catch (err) {
      await this.deps.updateExecution(executionId, {
        status: 'failed',
        errorMessage: String(err),
        completedAt: new Date(),
        migratedRows: totalMigrated,
        failedRows: totalFailed,
      });
      throw err;
    }
  }

  private async _processBatch(
    rows: Record<string, unknown>[],
    tableMapping: MigrationPlan['tableMappings'][number],
    batchIndex: number,
    _plan: MigrationPlan,
  ): Promise<BatchResult> {
    const errors: RowError[] = [];
    const targetRows: Record<string, unknown>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const sourceRow = rows[i]!;
      try {
        const targetRow: Record<string, unknown> = {};
        for (const cm of tableMapping.columnMappings) {
          const sourceValue = cm.sourceColumnId != null ? sourceRow[cm.sourceColumnId] : (cm.literalValue ?? null);
          const result = this.engine.apply(sourceValue, cm.transformations, {
            sourceRow,
            sourceColumnName: cm.sourceColumnId ?? '',
            targetColumnType: cm.targetColumnId,
          });
          if (result.error) throw new Error(result.error);
          targetRow[cm.targetColumnId] = result.value;
        }
        targetRows.push(targetRow);
      } catch (err) {
        errors.push({ sourceTableId: tableMapping.sourceTableId, rowIndex: batchIndex * rows.length + i, sourceValues: sourceRow, error: String(err) });
      }
    }

    if (targetRows.length > 0) {
      const insertResult = await this.deps.bulkInsertRows(tableMapping.targetTableId, targetRows);
      const insertErrors = insertResult.errors.map(e => ({
        sourceTableId: tableMapping.sourceTableId,
        rowIndex: batchIndex * rows.length + e.index,
        sourceValues: targetRows[e.index] ?? {},
        error: e.error,
      }));
      errors.push(...insertErrors);
    }

    return {
      batchIndex,
      rowsAttempted: rows.length,
      rowsSucceeded: rows.length - errors.length,
      rowsFailed: errors.length,
      errors,
      completedAt: new Date(),
    };
  }

  private async *_batchedStream(
    sourceConnectionId: string,
    tableId: string,
    batchSize: number,
    startBatch: number,
  ): AsyncIterable<Record<string, unknown>[]> {
    let currentBatch: Record<string, unknown>[] = [];
    let batchCount = 0;

    for await (const batch of this.deps.streamSourceRows(sourceConnectionId, tableId, batchSize)) {
      if (batchCount < startBatch) {
        batchCount++;
        continue;
      }
      yield batch;
    }

    if (currentBatch.length > 0) {
      yield currentBatch;
    }
  }

  private async _validate(executionId: string, plan: MigrationPlan, migratedRows: number): Promise<void> {
    const failures: string[] = [];

    for (const tm of plan.tableMappings) {
      const count = await this.deps.checkRowCount(tm.targetTableId);
      if (Math.abs(count - migratedRows) > Math.ceil(migratedRows * 0.001)) {
        failures.push(`Row count mismatch in ${tm.targetTableId}: expected ~${migratedRows}, got ${count}`);
      }

      const fk = await this.deps.checkFkIntegrity(tm.targetTableId);
      if (fk.violations > 0) {
        failures.push(`FK integrity violations in ${tm.targetTableId}: ${fk.violations}`);
      }

      const truncation = await this.deps.checkTruncation(tm.targetTableId);
      if (truncation.truncated.length > 0) {
        failures.push(`Possible truncation in ${tm.targetTableId}: columns ${truncation.truncated.join(', ')}`);
      }
    }

    if (failures.length > 0) {
      await this.deps.updateExecution(executionId, { errorMessage: `Validation: ${failures.join('; ')}` });
    }
  }

  async rollback(executionId: string): Promise<void> {
    const execution = await this.deps.getExecution(executionId);
    if (!execution?.snapshotId) throw new Error('No snapshot available for rollback');

    await this.deps.restoreSnapshot(execution.snapshotId);
    await this.deps.updateExecution(executionId, { status: 'rolled_back', completedAt: new Date() });
  }
}
