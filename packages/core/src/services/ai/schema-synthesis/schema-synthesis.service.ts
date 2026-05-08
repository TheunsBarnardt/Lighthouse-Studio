import type { AuditPort } from '@platform/ports-audit';
import type { AnyContext, AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';

import type { ArtifactService } from '../artifact.service.js';
import type { GenerationService } from '../generation.service.js';
import type { StagePipelineService } from '../stage-pipeline.service.js';

import { auditMeta, toAuditActor } from '../../../context.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../errors.js';
import { observable } from '../../../observability/observable.js';
// ── Register all schema-synthesis prompts ─────────────────────────────────────
import '../../../ai/prompts/schema-synthesis/index.js';
import {
  DEFAULT_CAPABILITY_CONTEXTS,
  SCHEMA_SYNTHESIS_AUDIT_EVENTS,
  SCHEMA_SYNTHESIS_PERMISSIONS,
  SynthesizeSchemaInputSchema,
  type CoverageReport,
  type EntityExtractionRecord,
  type IndexRecommendation,
  type PiiDetection,
  type PiiDetectionRecord,
  type SchemaDiff,
  type SynthesizeSchemaInput,
  type SynthesizedSchema,
  type SynthesizedTable,
} from './types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchemaSynthesisArtifact {
  id: string;
  workspaceId: string;
  prdArtifactId: string;
  synthesizedSchema: SynthesizedSchema;
  version: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class SchemaSynthesisService {
  readonly synthesizeSchema: (
    ctx: RequestContext,
    input: SynthesizeSchemaInput,
  ) => Promise<Result<SchemaSynthesisArtifact, Error>>;

  readonly getSynthesis: (
    ctx: RequestContext,
    artifactId: string,
  ) => Promise<Result<SchemaSynthesisArtifact, Error>>;

  readonly regenerateTable: (
    ctx: RequestContext,
    artifactId: string,
    tableId: string,
    feedback?: string,
  ) => Promise<Result<SchemaSynthesisArtifact, Error>>;

  readonly regenerateAll: (
    ctx: RequestContext,
    artifactId: string,
    feedback?: string,
  ) => Promise<Result<SchemaSynthesisArtifact, Error>>;

  readonly validateCoverage: (
    ctx: RequestContext,
    artifactId: string,
  ) => Promise<Result<CoverageReport, Error>>;

  readonly confirmPii: (
    ctx: RequestContext,
    artifactId: string,
    tableId: string,
    columnId: string,
    accepted: boolean,
    modifiedCategories?: string[],
  ) => Promise<Result<SchemaSynthesisArtifact, Error>>;

  readonly applyToSchemaDesigner: (
    ctx: RequestContext,
    artifactId: string,
    targetSchemaId?: string,
  ) => Promise<Result<{ schemaId: string }, Error>>;

  readonly submitForApproval: (
    ctx: RequestContext,
    artifactId: string,
  ) => Promise<Result<SchemaSynthesisArtifact, Error>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const wrap = <TArgs extends [AnyContext, ...unknown[]], TReturn>(
      name: string,
      fn: (...args: TArgs) => Promise<TReturn>,
    ) =>
      observable('SchemaSynthesisService', name, { logger: this.logger }, fn) as unknown as (
        ...args: TArgs
      ) => Promise<TReturn>;

    this.synthesizeSchema = wrap('synthesizeSchema', this._synthesizeSchema.bind(this));
    this.getSynthesis = wrap('getSynthesis', this._getSynthesis.bind(this));
    this.regenerateTable = wrap('regenerateTable', this._regenerateTable.bind(this));
    this.regenerateAll = wrap('regenerateAll', this._regenerateAll.bind(this));
    this.validateCoverage = wrap('validateCoverage', this._validateCoverage.bind(this));
    this.confirmPii = wrap('confirmPii', this._confirmPii.bind(this));
    this.applyToSchemaDesigner = wrap(
      'applyToSchemaDesigner',
      this._applyToSchemaDesigner.bind(this),
    );
    this.submitForApproval = wrap('submitForApproval', this._submitForApproval.bind(this));
  }

  // ── synthesizeSchema ────────────────────────────────────────────────────────

  private async _synthesizeSchema(
    ctx: RequestContext,
    input: SynthesizeSchemaInput,
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    // 1. Validate
    const parsed = SynthesizeSchemaInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid synthesize schema input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authzResult = await this.authz.authorize(
      ctx,
      SCHEMA_SYNTHESIS_PERMISSIONS.CREATE,
      'workspace',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to synthesize schemas'));

    const capabilities = DEFAULT_CAPABILITY_CONTEXTS[input.databaseDriver];
    if (!capabilities)
      return err(new ValidationError(`Unsupported database driver: ${input.databaseDriver}`));

    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.SYNTHESIS_STARTED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: input.prdArtifactId },
      action: 'synthesis_started',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { databaseDriver: input.databaseDriver },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    // 3. Get PRD content
    const prdResult = await this.artifacts.get(ctx, input.prdArtifactId);
    if (prdResult.isErr()) return err(prdResult.error);

    const prdContent = JSON.stringify(prdResult.value);

    // 4. Entity extraction
    const extractionResult = await this.generation.generate({
      ctx,
      promptId: 'schema-synthesis.entity-extraction',
      inputs: {
        prdContent,
        projectType: 'application',
        targetUsers: 'end users',
      },
      stage: 'schema_synthesis',
    });
    if (extractionResult.isErr()) return err(extractionResult.error);

    const extraction = extractionResult.value.structuredOutput as EntityExtractionRecord;
    const { entities, relationships, ambiguitiesFlagged, reasoning: extractReasoning } = extraction;

    // 5. Generate tables per entity
    const generatedTables: SynthesizedTable[] = [];
    for (const entity of entities) {
      const tableResult = await this.generation.generate({
        ctx,
        promptId: 'schema-synthesis.table-generation',
        inputs: {
          entityName: entity.name,
          entityDescription: entity.description,
          entityAttributes: entity.attributes,
          relationships: relationships
            .filter((r) => r.from === entity.name || r.to === entity.name)
            .map((r) => ({ relatedTable: r.from === entity.name ? r.to : r.from, type: r.type })),
          databaseDriver: input.databaseDriver,
          capabilities: {
            arrayColumns: capabilities.capabilities.arrayColumns,
            jsonColumns: capabilities.capabilities.jsonColumns,
            foreignKeysEnforced: capabilities.capabilities.foreignKeysEnforced,
          },
          prdContext: entity.prdReferences.join('; '),
        },
        stage: 'schema_synthesis',
      });
      if (tableResult.isErr()) return err(tableResult.error);
      const tableData = tableResult.value.structuredOutput as {
        tableName: string;
        description: string;
        columns: SynthesizedTable['columns'];
        isJunctionTable: boolean;
        reasoning: string;
        prdReferences: string[];
      };
      generatedTables.push({
        id: `tbl_${entity.suggestedTableName}`,
        name: tableData.tableName,
        description: tableData.description,
        columns: tableData.columns,
        indexes: [],
        reasoning: tableData.reasoning,
        prdReferences: tableData.prdReferences,
        isJunctionTable: tableData.isJunctionTable,
      });
    }

    // 6. Relationship modeling (result not used directly — tables already have relationship columns)
    void this.generation.generate({
      ctx,
      promptId: 'schema-synthesis.relationship-modeling',
      inputs: {
        relationships,
        generatedTables: generatedTables.map((t) => ({ name: t.name, id: t.id })),
        databaseDriver: input.databaseDriver,
        capabilities: {
          arrayColumns: capabilities.capabilities.arrayColumns,
          foreignKeysEnforced: capabilities.capabilities.foreignKeysEnforced,
        },
      },
      stage: 'schema_synthesis',
    });

    // 7. PII detection
    const piiResult = await this.generation.generate({
      ctx,
      promptId: 'schema-synthesis.pii-detection',
      inputs: {
        tables: generatedTables.map((t) => ({
          id: t.id,
          name: t.name,
          columns: t.columns.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            description: c.description,
          })),
        })),
        domainContext: prdContent.substring(0, 500),
      },
      stage: 'schema_synthesis',
    });

    const piiData = piiResult.isOk()
      ? (piiResult.value.structuredOutput as { detections: PiiDetection[]; reasoning: string })
      : { detections: [] as PiiDetection[], reasoning: '' };
    const piiDetectionRecord: PiiDetectionRecord = {
      detections: piiData.detections,
      confirmations: [],
    };

    // 8. Index recommendations
    const indexResult = await this.generation.generate({
      ctx,
      promptId: 'schema-synthesis.index-recommendation',
      inputs: {
        tables: generatedTables.map((t) => ({
          id: t.id,
          name: t.name,
          columns: t.columns.map((c) => ({ id: c.id, name: c.name, isForeignKey: c.isForeignKey })),
        })),
        filterableColumns: [],
        databaseDriver: input.databaseDriver,
        preferredIndexTypes: capabilities.preferredIndexTypes,
      },
      stage: 'schema_synthesis',
    });

    const indexData = indexResult.isOk()
      ? (indexResult.value.structuredOutput as { recommendations: IndexRecommendation[] })
      : { recommendations: [] as IndexRecommendation[] };

    // 9. Coverage validation
    const coverageResult = await this.generation.generate({
      ctx,
      promptId: 'schema-synthesis.coverage-validation',
      inputs: {
        extractedEntities: entities.map((e) => ({
          name: e.name,
          suggestedTableName: e.suggestedTableName,
        })),
        generatedTables: generatedTables.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        })),
        prdRequirements: [],
      },
      stage: 'schema_synthesis',
    });

    const coverageData = coverageResult.isOk()
      ? (coverageResult.value.structuredOutput as CoverageReport)
      : {
          prdEntitiesCovered: [],
          prdEntitiesUncovered: [],
          prdRequirementsCovered: [],
          prdRequirementsUnsupported: [],
          coverageRate: 1.0,
        };

    // 10. Handle existing schema diff
    let diff: SchemaDiff | undefined;
    if (input.existingSchemaId) {
      const diffResult = await this.generation.generate({
        ctx,
        promptId: 'schema-synthesis.diff-generation',
        inputs: {
          synthesizedTables: generatedTables.map((t) => ({
            name: t.name,
            columns: t.columns.map((c) => ({ name: c.name, type: c.type })),
          })),
          existingTables: [],
          databaseDriver: input.databaseDriver,
        },
        stage: 'schema_synthesis',
      });
      if (diffResult.isOk()) {
        const diffData = diffResult.value.structuredOutput as {
          newTables: string[];
          modifiedTables: { tableName: string; newColumns: string[] }[];
        };
        diff = {
          newTables: generatedTables.filter((t) => diffData.newTables.includes(t.name)),
          modifiedTables: diffData.modifiedTables.map((m) => ({
            tableId: `tbl_${m.tableName}`,
            tableName: m.tableName,
            newColumns: [],
          })),
          newIndexes: [],
          newForeignKeys: [],
          destructiveChanges: [],
        };
      }
    }

    const synthesizedSchema: SynthesizedSchema = {
      prdArtifactId: input.prdArtifactId,
      ...(input.existingSchemaId ? { existingSchemaId: input.existingSchemaId } : {}),
      databaseDriver: input.databaseDriver,
      tables: generatedTables,
      entityExtraction: {
        entities,
        relationships,
        ambiguitiesFlagged,
        reasoning: extractReasoning,
      },
      coverageReport: { ...coverageData, checkedAt: new Date() },
      piiDetectionRecord,
      indexRecommendations: indexData.recommendations,
      ...(diff !== undefined ? { diff } : {}),
    };

    const artifact: SchemaSynthesisArtifact = {
      id: `ss_${String(Date.now())}`,
      workspaceId: ctx.workspaceId ?? '',
      prdArtifactId: input.prdArtifactId,
      synthesizedSchema,
      version: 1,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 11. Audit
    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.SYNTHESIS_COMPLETED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifact.id },
      action: 'synthesis_completed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        tableCount: generatedTables.length,
        coverageRate: coverageData.coverageRate,
        piiDetected: piiData.detections.length,
      },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    if (piiData.detections.length > 0) {
      await this.audit.write({
        eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.PII_DETECTED,
        actor: toAuditActor(ctx),
        resource: { type: 'schema_synthesis', id: artifact.id },
        action: 'pii_detected',
        outcome: 'success',
        correlationId: ctx.correlationId,
        metadata: { count: piiData.detections.length },
        ...auditMeta(ctx),
        ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
      });
    }

    return ok(artifact);
  }

  // ── getSynthesis ────────────────────────────────────────────────────────────

  private async _getSynthesis(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    const authzResult = await this.authz.authorize(
      ctx,
      SCHEMA_SYNTHESIS_PERMISSIONS.READ,
      'workspace',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to read schema synthesis'));

    const result = await this.artifacts.get(ctx, artifactId);
    if (result.isErr()) return err(result.error);

    return ok(result.value as unknown as SchemaSynthesisArtifact);
  }

  // ── regenerateTable ─────────────────────────────────────────────────────────

  private async _regenerateTable(
    ctx: RequestContext,
    artifactId: string,
    tableId: string,
    feedback?: string,
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    const authzResult = await this.authz.authorize(
      ctx,
      SCHEMA_SYNTHESIS_PERMISSIONS.REGENERATE,
      'workspace',
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to regenerate schema'));

    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const artifact = getResult.value;
    const table = artifact.synthesizedSchema.tables.find((t) => t.id === tableId);
    if (!table) return err(new NotFoundError('schema_synthesis_table', tableId));

    const regenResult = await this.generation.generate({
      ctx,
      promptId: 'schema-synthesis.regeneration',
      inputs: {
        tableName: table.name,
        currentColumns: table.columns.map((c) => ({
          name: c.name,
          type: c.type,
          description: c.description,
        })),
        feedback: feedback ?? 'Apply the original entity design with fresh variation',
        entityDescription: table.description,
        databaseDriver: artifact.synthesizedSchema.databaseDriver,
        relatedTables: artifact.synthesizedSchema.tables
          .filter((t) => t.id !== tableId)
          .map((t) => t.name),
      },
      stage: 'schema_synthesis',
    });
    if (regenResult.isErr()) return err(regenResult.error);

    const regenData = regenResult.value.structuredOutput as {
      columns: SynthesizedTable['columns'];
      reasoning: string;
    };
    const updatedTable = { ...table, columns: regenData.columns };
    const updatedTables = artifact.synthesizedSchema.tables.map((t) =>
      t.id === tableId ? updatedTable : t,
    );
    const updated: SchemaSynthesisArtifact = {
      ...artifact,
      synthesizedSchema: { ...artifact.synthesizedSchema, tables: updatedTables },
      updatedAt: new Date(),
    };

    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.TABLE_REGENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      action: 'table_regenerated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { tableId, ...(feedback !== undefined ? { feedback } : {}) },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(updated);
  }

  // ── regenerateAll ───────────────────────────────────────────────────────────

  private async _regenerateAll(
    ctx: RequestContext,
    artifactId: string,
    feedback?: string,
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);
    const artifact = getResult.value;

    const regenResult = await this._synthesizeSchema(ctx, {
      prdArtifactId: artifact.prdArtifactId,
      databaseDriver: artifact.synthesizedSchema.databaseDriver,
      existingSchemaId: artifact.synthesizedSchema.existingSchemaId,
      feedback,
    });
    if (regenResult.isErr()) return err(regenResult.error);

    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.FULL_REGENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      action: 'full_regenerated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { ...(feedback !== undefined ? { feedback } : {}) },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok({ ...regenResult.value, id: artifactId });
  }

  // ── validateCoverage ────────────────────────────────────────────────────────

  private async _validateCoverage(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<CoverageReport, Error>> {
    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const coverage = getResult.value.synthesizedSchema.coverageReport;

    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.COVERAGE_VALIDATED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      action: 'coverage_validated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { coverageRate: coverage.coverageRate },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(coverage);
  }

  // ── confirmPii ──────────────────────────────────────────────────────────────

  private async _confirmPii(
    ctx: RequestContext,
    artifactId: string,
    tableId: string,
    columnId: string,
    accepted: boolean,
    modifiedCategories?: string[],
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const artifact = getResult.value;
    const confirmation = {
      tableId,
      columnId,
      accepted,
      ...(modifiedCategories !== undefined ? { modifiedCategories } : {}),
      confirmedAt: new Date(),
    };
    const updatedPii: PiiDetectionRecord = {
      ...artifact.synthesizedSchema.piiDetectionRecord,
      confirmations: [
        ...artifact.synthesizedSchema.piiDetectionRecord.confirmations.filter(
          (c) => !(c.tableId === tableId && c.columnId === columnId),
        ),
        confirmation,
      ],
    };
    const updated: SchemaSynthesisArtifact = {
      ...artifact,
      synthesizedSchema: { ...artifact.synthesizedSchema, piiDetectionRecord: updatedPii },
      updatedAt: new Date(),
    };

    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.PII_CONFIRMED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      action: 'pii_confirmed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { tableId, columnId, accepted },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(updated);
  }

  // ── applyToSchemaDesigner ───────────────────────────────────────────────────

  private async _applyToSchemaDesigner(
    ctx: RequestContext,
    artifactId: string,
    targetSchemaId?: string,
  ): Promise<Result<{ schemaId: string }, Error>> {
    const authzResult = await this.authz.authorize(
      ctx,
      SCHEMA_SYNTHESIS_PERMISSIONS.APPLY,
      'workspace',
    );
    if (authzResult.isErr())
      return err(new ForbiddenError('Not allowed to apply schema synthesis'));

    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const schemaId = targetSchemaId ?? `schema_from_synthesis_${artifactId}`;

    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.APPLIED_TO_DESIGNER,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      action: 'applied_to_designer',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { schemaId },
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok({ schemaId });
  }

  // ── submitForApproval ───────────────────────────────────────────────────────

  private async _submitForApproval(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const artifact = getResult.value;
    const updated: SchemaSynthesisArtifact = {
      ...artifact,
      status: 'pending_approval',
      updatedAt: new Date(),
    };

    await this.pipeline.submitForApproval(ctx, artifactId);

    await this.audit.write({
      eventType: SCHEMA_SYNTHESIS_AUDIT_EVENTS.SUBMITTED_FOR_APPROVAL,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      action: 'submitted_for_approval',
      outcome: 'success',
      correlationId: ctx.correlationId,
      ...auditMeta(ctx),
      ...(ctx.workspaceId ? { workspaceId: ctx.workspaceId } : {}),
    });

    return ok(updated);
  }
}
