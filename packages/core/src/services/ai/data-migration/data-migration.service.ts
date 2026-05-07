import { ok, err, type Result } from 'neverthrow';
import { observable } from '../../../observability/observable.js';
import { ValidationError, NotFoundError, AuthorizationError, ForbiddenError } from '../../../errors.js';
import type { RequestContext, AuthorizationPort } from '@platform/ports-authorization';
import type { AuditPort } from '@platform/ports-audit';
import type { LoggerPort } from '@platform/ports-observability';
import type { AppError } from '../../../errors.js';
import { ArtifactService } from '../artifact.service.js';
import { GenerationService } from '../generation.service.js';
import { StagePipelineService } from '../stage-pipeline.service.js';
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
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  async connectSource(ctx: RequestContext, input: ConnectSourceInput): Promise<Result<SourceConnection, AppError>> {
    return observable('DataMigrationService', 'connectSource', ctx, async () => {
      const parsed = ConnectSourceInputSchema.safeParse(input);
      if (!parsed.success) return err(new ValidationError('Invalid source input', parsed.error.flatten()));

      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.CREATE, { workspaceId: input.workspaceId });
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

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.SOURCE_CONNECTED,
        meta: { connectionId: connection.id, type: input.type },
      });

      return ok(connection);
    });
  }

  async uploadSourceFile(ctx: RequestContext, input: UploadSourceFileInput): Promise<Result<SourceConnection, AppError>> {
    return observable('DataMigrationService', 'uploadSourceFile', ctx, async () => {
      const parsed = UploadSourceFileInputSchema.safeParse(input);
      if (!parsed.success) return err(new ValidationError('Invalid file input', parsed.error.flatten()));

      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.CREATE, { workspaceId: input.workspaceId });
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

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.SOURCE_CONNECTED,
        meta: { connectionId: connection.id, type: input.type, fileName: input.fileName },
      });

      return ok(connection);
    });
  }

  async introspectSource(ctx: RequestContext, sourceConnectionId: string): Promise<Result<SourceDescription, AppError>> {
    return observable('DataMigrationService', 'introspectSource', ctx, async () => {
      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.CREATE, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

      // In production this delegates to the source adapter port
      const description: SourceDescription = {
        type: 'postgres',
        identifier: sourceConnectionId,
        tables: [],
        totalRowCount: 0,
        introspectedAt: new Date(),
      };

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.SOURCE_INTROSPECTED,
        meta: { sourceConnectionId, tableCount: description.tables.length },
      });

      return ok(description);
    });
  }

  async generateMappingPlan(ctx: RequestContext, input: GenerateMappingInput): Promise<Result<MigrationPlanArtifact, AppError>> {
    return observable('DataMigrationService', 'generateMappingPlan', ctx, async () => {
      const parsed = GenerateMappingInputSchema.safeParse(input);
      if (!parsed.success) return err(new ValidationError('Invalid mapping input', parsed.error.flatten()));

      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.CREATE, { workspaceId: input.workspaceId });
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to create migration plans'));

      const orchestrationResult = await this.generation.run('data-migration.orchestrator', {
        sourceDescription: { type: 'postgres', totalRowCount: 0, tables: [] },
        targetSchema: { tables: [] },
        prdSummary: 'Migrating data',
      });

      const mappingResult = await this.generation.run('data-migration.mapping-generation', {
        sourceDescription: { type: 'postgres', tables: [], totalRowCount: 0 },
        targetSchema: { tables: [] },
        prdSummary: 'Migrating data',
        userNotes: input.userNotes,
        databaseDriver: 'postgres',
      });

      const fkResult = await this.generation.run('data-migration.fk-resolution-strategy', {
        sourceRelationships: [],
        targetSchema: { tables: [] },
        databaseDriver: 'postgres',
      });

      const validationResult = await this.generation.run('data-migration.validation-rules', {
        tableMappings: [],
        targetSchema: { tables: [] },
        sourceDescription: { type: 'postgres', tables: [] },
      });

      const artifact: MigrationPlanArtifact = {
        id: crypto.randomUUID(),
        workspaceId: input.workspaceId,
        plan: {
          prdArtifactId: input.prdArtifactId,
          schemaArtifactId: input.schemaArtifactId,
          sourceConnectionId: input.sourceConnectionId,
          sourceDescription: { type: 'postgres', identifier: input.sourceConnectionId, tables: [], totalRowCount: 0, introspectedAt: new Date() },
          tableMappings: (mappingResult as { tableMappings?: unknown[] }).tableMappings ?? [],
          preExecutionChecks: [],
          postExecutionChecks: (validationResult as { postExecutionChecks?: unknown[] }).postExecutionChecks as any[] ?? [],
          toleranceMode: 'fail_on_batch_error',
          batchSize: 1000,
          irreversibleOperations: (mappingResult as { irreversibleOperations?: unknown[] }).irreversibleOperations as any[] ?? [],
          mappingNotes: (mappingResult as { mappingNotes?: string }).mappingNotes,
          reasoning: (orchestrationResult as { reasoning?: string }).reasoning,
        },
        status: 'draft',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.MAPPING_GENERATED,
        meta: {
          planId: artifact.id,
          tableCount: artifact.plan.tableMappings.length,
          reasoning: artifact.plan.reasoning,
        },
      });

      return ok(artifact);
    });
  }

  async updateMappingPlan(ctx: RequestContext, planId: string, changes: MappingPlanChanges): Promise<Result<MigrationPlanArtifact, AppError>> {
    return observable('DataMigrationService', 'updateMappingPlan', ctx, async () => {
      const parsed = MappingPlanChangesSchema.safeParse(changes);
      if (!parsed.success) return err(new ValidationError('Invalid plan changes', parsed.error.flatten()));

      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.CREATE, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.MAPPING_EDITED,
        meta: { planId, changedFields: Object.keys(changes) },
      });

      // In production, fetch, merge, persist and return
      return err(new NotFoundError(`Plan ${planId} not found`));
    });
  }

  async previewMigration(ctx: RequestContext, planId: string, sampleSize = 100): Promise<Result<MigrationPreview, AppError>> {
    return observable('DataMigrationService', 'previewMigration', ctx, async () => {
      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.READ, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

      const preview: MigrationPreview = {
        planId,
        sampleSize,
        rows: [],
        totalErrors: 0,
        totalWarnings: 0,
        previewedAt: new Date(),
      };

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.PREVIEW_RUN,
        meta: { planId, sampleSize },
      });

      return ok(preview);
    });
  }

  async submitForApproval(ctx: RequestContext, planId: string): Promise<Result<MigrationPlanArtifact, AppError>> {
    return observable('DataMigrationService', 'submitForApproval', ctx, async () => {
      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.CREATE, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

      await this.pipeline.submitForApproval(ctx, { artifactId: planId, stage: 'data_migration' });

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.SUBMITTED_FOR_APPROVAL,
        meta: { planId },
      });

      return err(new NotFoundError(`Plan ${planId} not found`));
    });
  }

  async executeMigration(ctx: RequestContext, planId: string, options: ExecuteOptions): Promise<Result<MigrationExecution, AppError>> {
    return observable('DataMigrationService', 'executeMigration', ctx, async () => {
      const parsed = ExecuteOptionsSchema.safeParse(options);
      if (!parsed.success) return err(new ValidationError('Invalid execute options', parsed.error.flatten()));

      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.EXECUTE, {});
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

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.EXECUTION_STARTED,
        meta: { executionId, planId, toleranceMode: options.toleranceMode ?? 'fail_on_batch_error' },
      });

      return ok(execution);
    });
  }

  async getExecutionStatus(ctx: RequestContext, executionId: string): Promise<Result<MigrationExecution, AppError>> {
    return observable('DataMigrationService', 'getExecutionStatus', ctx, async () => {
      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.READ, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

      return err(new NotFoundError(`Execution ${executionId} not found`));
    });
  }

  async cancelExecution(ctx: RequestContext, executionId: string): Promise<Result<void, AppError>> {
    return observable('DataMigrationService', 'cancelExecution', ctx, async () => {
      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.EXECUTE, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.EXECUTION_CANCELLED,
        meta: { executionId },
      });

      return ok(undefined);
    });
  }

  async validateMigration(ctx: RequestContext, executionId: string): Promise<Result<MigrationValidationReport, AppError>> {
    return observable('DataMigrationService', 'validateMigration', ctx, async () => {
      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.READ, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

      const report: MigrationValidationReport = {
        executionId,
        checksRun: 0,
        checksPassed: 0,
        checksFailed: 0,
        failures: [],
      };

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.VALIDATION_RUN,
        meta: { executionId, checksPassed: report.checksPassed, checksFailed: report.checksFailed },
      });

      return ok(report);
    });
  }

  async rollbackMigration(ctx: RequestContext, executionId: string): Promise<Result<MigrationRollbackResult, AppError>> {
    return observable('DataMigrationService', 'rollbackMigration', ctx, async () => {
      const authzResult = await this.authz.authorize(ctx, DATA_MIGRATION_PERMISSIONS.ROLLBACK, {});
      if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to rollback migrations'));

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.ROLLBACK_INITIATED,
        meta: { executionId },
      });

      const result: MigrationRollbackResult = {
        executionId,
        snapshotId: '',
        tablesRestored: [],
        completedAt: new Date(),
      };

      await this.audit.write(ctx, {
        event: DATA_MIGRATION_AUDIT_EVENTS.ROLLBACK_COMPLETED,
        meta: { executionId },
      });

      return ok(result);
    });
  }

  private _redactConnectionString(connectionString: string): string {
    return connectionString.replace(/\/\/[^:]+:[^@]+@/, '//****:****@');
  }
}
