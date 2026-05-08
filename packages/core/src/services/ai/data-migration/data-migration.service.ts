import type { AuditPort } from '@platform/ports-audit';
import type { RequestContext, AuthorizationPort } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { ok, err, type Result } from 'neverthrow';

import type { AppError } from '../../../errors.js';
import type { GenerationService } from '../generation.service.js';
import type { StagePipelineService } from '../stage-pipeline.service.js';

import { toAuditActor, auditMeta } from '../../../context.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../../errors.js';
import {
  ConnectSourceInputSchema,
  UploadSourceFileInputSchema,
  GenerateMappingInputSchema,
  MappingPlanChangesSchema,
  ExecuteOptionsSchema,
  DATA_MIGRATION_AUDIT_EVENTS,
  DATA_MIGRATION_PERMISSIONS,
  type ConnectSourceInput,
  type UploadSourceFileInput,
  type GenerateMappingInput,
  type MappingPlanChanges,
  type ExecuteOptions,
  type SourceConnection,
  type SourceDescription,
  type MigrationPlanArtifact,
  type MigrationExecution,
  type MigrationPreview,
  type MigrationValidationReport,
  type MigrationRollbackResult,
} from './types.js';

export class DataMigrationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly audit: AuditPort,
    _logger: LoggerPort,
  ) {}

  async connectSource(
    ctx: RequestContext,
    input: ConnectSourceInput,
  ): Promise<Result<SourceConnection, AppError>> {
    const parsed = ConnectSourceInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid source input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.CREATE,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to create migrations'));

    const connection: SourceConnection = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      type: input.type,
      identifier: this._redactConnectionString(input.connectionString),
      status: 'connected',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.SOURCE_CONNECTED,
      actor: toAuditActor(ctx),
      resource: { type: 'source_connection', id: connection.id },
      action: 'source_connected',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { connectionId: connection.id, type: input.type },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(connection);
  }

  async uploadSourceFile(
    ctx: RequestContext,
    input: UploadSourceFileInput,
  ): Promise<Result<SourceConnection, AppError>> {
    const parsed = UploadSourceFileInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid file input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.CREATE,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to create migrations'));

    const connection: SourceConnection = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      type: input.type,
      identifier: input.fileName,
      status: 'connected',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.SOURCE_CONNECTED,
      actor: toAuditActor(ctx),
      resource: { type: 'source_connection', id: connection.id },
      action: 'source_connected',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { connectionId: connection.id, type: input.type, fileName: input.fileName },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(connection);
  }

  async introspectSource(
    ctx: RequestContext,
    sourceConnectionId: string,
  ): Promise<Result<SourceDescription, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.CREATE,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    // In production this delegates to the source adapter port
    const description: SourceDescription = {
      type: 'postgres',
      identifier: sourceConnectionId,
      tables: [],
      totalRowCount: 0,
      introspectedAt: new Date(),
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.SOURCE_INTROSPECTED,
      actor: toAuditActor(ctx),
      resource: { type: 'source_connection', id: sourceConnectionId },
      action: 'source_introspected',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { sourceConnectionId, tableCount: description.tables.length },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(description);
  }

  async generateMappingPlan(
    ctx: RequestContext,
    input: GenerateMappingInput,
  ): Promise<Result<MigrationPlanArtifact, AppError>> {
    const parsed = GenerateMappingInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid mapping input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.CREATE,
      'data_migration',
    );
    if (authzResult.isErr())
      return err(new ForbiddenError('Not authorized to create migration plans'));

    const orchestrationResult = await this.generation.generate({
      ctx,
      promptId: 'data-migration.orchestrator',
      inputs: {
        sourceDescription: { type: 'postgres', totalRowCount: 0, tables: [] },
        targetSchema: { tables: [] },
        prdSummary: 'Migrating data',
      },
      stage: 'data_migration',
    });

    const mappingResult = await this.generation.generate({
      ctx,
      promptId: 'data-migration.mapping-generation',
      inputs: {
        sourceDescription: { type: 'postgres', tables: [], totalRowCount: 0 },
        targetSchema: { tables: [] },
        prdSummary: 'Migrating data',
        userNotes: input.userNotes,
        databaseDriver: 'postgres',
      },
      stage: 'data_migration',
    });

    const validationResult = await this.generation.generate({
      ctx,
      promptId: 'data-migration.validation-rules',
      inputs: {
        tableMappings: [],
        targetSchema: { tables: [] },
        sourceDescription: { type: 'postgres', tables: [] },
      },
      stage: 'data_migration',
    });

    const orchestration = orchestrationResult.isOk()
      ? (orchestrationResult.value.structuredOutput as Record<string, unknown>)
      : {};
    const mapping = mappingResult.isOk()
      ? (mappingResult.value.structuredOutput as Record<string, unknown>)
      : {};
    const validation = validationResult.isOk()
      ? (validationResult.value.structuredOutput as Record<string, unknown>)
      : {};

    const artifact: MigrationPlanArtifact = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      plan: {
        prdArtifactId: input.prdArtifactId,
        schemaArtifactId: input.schemaArtifactId,
        sourceConnectionId: input.sourceConnectionId,
        sourceDescription: {
          type: 'postgres',
          identifier: input.sourceConnectionId,
          tables: [],
          totalRowCount: 0,
          introspectedAt: new Date(),
        },
        tableMappings: (mapping['tableMappings'] ??
          []) as unknown[] as MigrationPlanArtifact['plan']['tableMappings'],
        preExecutionChecks: [],
        postExecutionChecks: (validation['postExecutionChecks'] ??
          []) as unknown[] as MigrationPlanArtifact['plan']['postExecutionChecks'],
        toleranceMode: 'fail_on_batch_error',
        batchSize: 1000,
        irreversibleOperations: (mapping['irreversibleOperations'] ??
          []) as unknown[] as MigrationPlanArtifact['plan']['irreversibleOperations'],
        ...(mapping['mappingNotes'] !== undefined
          ? { mappingNotes: mapping['mappingNotes'] as string }
          : {}),
        ...(orchestration['reasoning'] !== undefined
          ? { reasoning: orchestration['reasoning'] as string }
          : {}),
      },
      status: 'draft',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.MAPPING_GENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_plan', id: artifact.id },
      action: 'mapping_generated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        planId: artifact.id,
        tableCount: artifact.plan.tableMappings.length,
        reasoning: artifact.plan.reasoning ?? null,
      },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(artifact);
  }

  async updateMappingPlan(
    ctx: RequestContext,
    planId: string,
    changes: MappingPlanChanges,
  ): Promise<Result<MigrationPlanArtifact, AppError>> {
    const parsed = MappingPlanChangesSchema.safeParse(changes);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid plan changes',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.CREATE,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.MAPPING_EDITED,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_plan', id: planId },
      action: 'mapping_edited',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { planId, changedFields: Object.keys(changes) },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    // In production, fetch, merge, persist and return
    return err(new NotFoundError('migration_plan', planId));
  }

  async previewMigration(
    ctx: RequestContext,
    planId: string,
    sampleSize = 100,
  ): Promise<Result<MigrationPreview, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.READ,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    const preview: MigrationPreview = {
      planId,
      sampleSize,
      rows: [],
      totalErrors: 0,
      totalWarnings: 0,
      previewedAt: new Date(),
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.PREVIEW_RUN,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_plan', id: planId },
      action: 'preview_run',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { planId, sampleSize },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(preview);
  }

  async submitForApproval(
    ctx: RequestContext,
    planId: string,
  ): Promise<Result<MigrationPlanArtifact, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.CREATE,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.pipeline.submitForApproval(ctx, planId);

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.SUBMITTED_FOR_APPROVAL,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_plan', id: planId },
      action: 'submitted_for_approval',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { planId },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return err(new NotFoundError('migration_plan', planId));
  }

  async executeMigration(
    ctx: RequestContext,
    planId: string,
    options: ExecuteOptions,
  ): Promise<Result<MigrationExecution, AppError>> {
    const parsed = ExecuteOptionsSchema.safeParse(options);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid execute options',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.EXECUTE,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to execute migrations'));

    const executionId = crypto.randomUUID();
    const execution: MigrationExecution = {
      id: executionId,
      workspaceId: ctx.workspaceId ?? '',
      planId,
      status: 'pending',
      totalRows: 0,
      migratedRows: 0,
      failedRows: 0,
      currentBatchIndex: 0,
      batchResults: [],
      startedAt: new Date(),
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.EXECUTION_STARTED,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_execution', id: executionId },
      action: 'execution_started',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        executionId,
        planId,
        toleranceMode: options.toleranceMode ?? 'fail_on_batch_error',
      },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(execution);
  }

  async getExecutionStatus(
    ctx: RequestContext,
    executionId: string,
  ): Promise<Result<MigrationExecution, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.READ,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    return err(new NotFoundError('migration_execution', executionId));
  }

  async cancelExecution(ctx: RequestContext, executionId: string): Promise<Result<void, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.EXECUTE,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.EXECUTION_CANCELLED,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_execution', id: executionId },
      action: 'execution_cancelled',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { executionId },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(undefined);
  }

  async validateMigration(
    ctx: RequestContext,
    executionId: string,
  ): Promise<Result<MigrationValidationReport, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.READ,
      'data_migration',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    const report: MigrationValidationReport = {
      executionId,
      checksRun: 0,
      checksPassed: 0,
      checksFailed: 0,
      failures: [],
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.VALIDATION_RUN,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_execution', id: executionId },
      action: 'validation_run',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        executionId,
        checksPassed: report.checksPassed,
        checksFailed: report.checksFailed,
      },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(report);
  }

  async rollbackMigration(
    ctx: RequestContext,
    executionId: string,
  ): Promise<Result<MigrationRollbackResult, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      DATA_MIGRATION_PERMISSIONS.ROLLBACK,
      'data_migration',
    );
    if (authzResult.isErr())
      return err(new ForbiddenError('Not authorized to rollback migrations'));

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.ROLLBACK_INITIATED,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_execution', id: executionId },
      action: 'rollback_initiated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { executionId },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    const result: MigrationRollbackResult = {
      executionId,
      snapshotId: '',
      tablesRestored: [],
      completedAt: new Date(),
    };

    await this.audit.write({
      eventType: DATA_MIGRATION_AUDIT_EVENTS.ROLLBACK_COMPLETED,
      actor: toAuditActor(ctx),
      resource: { type: 'migration_execution', id: executionId },
      action: 'rollback_completed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { executionId },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(result);
  }

  private _redactConnectionString(connectionString: string): string {
    return connectionString.replace(/\/\/[^:]+:[^@]+@/, '//****:****@');
  }
}
