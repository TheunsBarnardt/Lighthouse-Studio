import { err, ok, type Result } from 'neverthrow';

import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { ForbiddenError, NotFoundError, ValidationError } from '../../../errors.js';
import { auditMeta, toAuditActor } from '../../../context.js';
import { observable } from '../../../observability/observable.js';
import type { ArtifactService } from '../artifact.service.js';
import type { GenerationService } from '../generation.service.js';
import type { StagePipelineService } from '../stage-pipeline.service.js';

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
    const wrap = <TArgs extends unknown[], TReturn>(
      name: string,
      fn: (...args: TArgs) => Promise<TReturn>,
    ) =>
      observable('SchemaSynthesisService', name, { logger: this.logger }, fn) as (
        ...args: TArgs
      ) => Promise<TReturn>;

    this.synthesizeSchema = wrap('synthesizeSchema', this._synthesizeSchema.bind(this));
    this.getSynthesis = wrap('getSynthesis', this._getSynthesis.bind(this));
    this.regenerateTable = wrap('regenerateTable', this._regenerateTable.bind(this));
    this.regenerateAll = wrap('regenerateAll', this._regenerateAll.bind(this));
    this.validateCoverage = wrap('validateCoverage', this._validateCoverage.bind(this));
    this.confirmPii = wrap('confirmPii', this._confirmPii.bind(this));
    this.applyToSchemaDesigner = wrap('applyToSchemaDesigner', this._applyToSchemaDesigner.bind(this));
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
      return err(new ValidationError('Invalid synthesize schema input', { issues: parsed.error.issues }));
    }

    // 2. Authorize
    const authzResult = await this.authz.authorize(ctx, SCHEMA_SYNTHESIS_PERMISSIONS.CREATE, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to synthesize schemas'));

    const capabilities = DEFAULT_CAPABILITY_CONTEXTS[input.databaseDriver];

    await this.audit.write({
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.SYNTHESIS_STARTED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: input.prdArtifactId },
      meta: auditMeta(ctx, { databaseDriver: input.databaseDriver }),
    });

    // 3. Get PRD content
    const prdResult = await this.artifacts.getById(ctx, input.prdArtifactId);
    if (prdResult.isErr()) return err(prdResult.error);
    if (!prdResult.value) return err(new NotFoundError(`PRD artifact ${input.prdArtifactId} not found`));

    const prdContent = JSON.stringify(prdResult.value);

    // 4. Entity extraction
    const extractionResult = await this.generation.run('schema-synthesis.entity-extraction', {
      prdContent,
      projectType: 'application',
      targetUsers: 'end users',
    });
    if (extractionResult.isErr()) return err(extractionResult.error);

    const extraction = extractionResult.value as EntityExtractionRecord;
    const { entities, relationships, ambiguitiesFlagged, reasoning: extractReasoning } = extraction;

    // 5. Generate tables per entity
    const generatedTables: SynthesizedTable[] = [];
    for (const entity of entities) {
      const tableResult = await this.generation.run('schema-synthesis.table-generation', {
        entityName: entity.name,
        entityDescription: entity.description,
        entityAttributes: entity.attributes,
        relationships: relationships
          .filter(r => r.from === entity.name || r.to === entity.name)
          .map(r => ({ relatedTable: r.from === entity.name ? r.to : r.from, type: r.type })),
        databaseDriver: input.databaseDriver,
        capabilities: {
          arrayColumns: capabilities.capabilities.arrayColumns,
          jsonColumns: capabilities.capabilities.jsonColumns,
          foreignKeysEnforced: capabilities.capabilities.foreignKeysEnforced,
        },
        prdContext: entity.prdReferences.join('; '),
      });
      if (tableResult.isErr()) return err(tableResult.error);
      const tableData = tableResult.value as { tableName: string; description: string; columns: SynthesizedTable['columns']; isJunctionTable: boolean; reasoning: string; prdReferences: string[] };
      generatedTables.push({
        id: `tbl_${entity.suggestedTableName}`,
        name: tableData.tableName ?? entity.suggestedTableName,
        description: tableData.description,
        columns: tableData.columns ?? [],
        indexes: [],
        reasoning: tableData.reasoning,
        prdReferences: tableData.prdReferences ?? [],
        isJunctionTable: tableData.isJunctionTable ?? false,
      });
    }

    // 6. Relationship modeling
    const relResult = await this.generation.run('schema-synthesis.relationship-modeling', {
      relationships,
      generatedTables: generatedTables.map(t => ({ name: t.name, id: t.id })),
      databaseDriver: input.databaseDriver,
      capabilities: {
        arrayColumns: capabilities.capabilities.arrayColumns,
        foreignKeysEnforced: capabilities.capabilities.foreignKeysEnforced,
      },
    });

    // 7. PII detection
    const piiResult = await this.generation.run('schema-synthesis.pii-detection', {
      tables: generatedTables.map(t => ({
        id: t.id, name: t.name,
        columns: t.columns.map(c => ({ id: c.id, name: c.name, type: c.type, description: c.description })),
      })),
      domainContext: prdContent.substring(0, 500),
    });

    const piiData = piiResult.isOk() ? (piiResult.value as { detections: PiiDetection[]; reasoning: string }) : { detections: [], reasoning: '' };
    const piiDetectionRecord: PiiDetectionRecord = { detections: piiData.detections, confirmations: [] };

    // 8. Index recommendations
    const indexResult = await this.generation.run('schema-synthesis.index-recommendation', {
      tables: generatedTables.map(t => ({
        id: t.id, name: t.name,
        columns: t.columns.map(c => ({ id: c.id, name: c.name, isForeignKey: c.isForeignKey })),
      })),
      filterableColumns: [],
      databaseDriver: input.databaseDriver,
      preferredIndexTypes: capabilities.preferredIndexTypes,
    });

    const indexData = indexResult.isOk() ? (indexResult.value as { recommendations: IndexRecommendation[] }) : { recommendations: [] };

    // 9. Coverage validation
    const coverageResult = await this.generation.run('schema-synthesis.coverage-validation', {
      extractedEntities: entities.map(e => ({ name: e.name, suggestedTableName: e.suggestedTableName })),
      generatedTables: generatedTables.map(t => ({ id: t.id, name: t.name, description: t.description })),
      prdRequirements: [],
    });

    const coverageData = coverageResult.isOk() ? (coverageResult.value as CoverageReport) : {
      prdEntitiesCovered: [], prdEntitiesUncovered: [],
      prdRequirementsCovered: [], prdRequirementsUnsupported: [],
      coverageRate: 1.0,
    };

    // 10. Handle existing schema diff
    let diff: SchemaDiff | undefined;
    if (input.existingSchemaId) {
      const diffResult = await this.generation.run('schema-synthesis.diff-generation', {
        synthesizedTables: generatedTables.map(t => ({ name: t.name, columns: t.columns.map(c => ({ name: c.name, type: c.type })) })),
        existingTables: [],
        databaseDriver: input.databaseDriver,
      });
      if (diffResult.isOk()) {
        const diffData = diffResult.value as { newTables: string[]; modifiedTables: { tableName: string; newColumns: string[] }[] };
        diff = {
          newTables: generatedTables.filter(t => diffData.newTables.includes(t.name)),
          modifiedTables: diffData.modifiedTables.map(m => ({ tableId: `tbl_${m.tableName}`, tableName: m.tableName, newColumns: [] })),
          newIndexes: [],
          newForeignKeys: [],
          destructiveChanges: [],
        };
      }
    }

    const synthesizedSchema: SynthesizedSchema = {
      prdArtifactId: input.prdArtifactId,
      existingSchemaId: input.existingSchemaId,
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
      diff,
    };

    const artifact: SchemaSynthesisArtifact = {
      id: `ss_${Date.now()}`,
      workspaceId: ctx.workspaceId,
      prdArtifactId: input.prdArtifactId,
      synthesizedSchema,
      version: 1,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 11. Audit
    await this.audit.write({
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.SYNTHESIS_COMPLETED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifact.id },
      meta: auditMeta(ctx, {
        tableCount: generatedTables.length,
        coverageRate: coverageData.coverageRate,
        piiDetected: piiData.detections.length,
      }),
    });

    if (piiData.detections.length > 0) {
      await this.audit.write({
        event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.PII_DETECTED,
        actor: toAuditActor(ctx),
        resource: { type: 'schema_synthesis', id: artifact.id },
        meta: auditMeta(ctx, { count: piiData.detections.length }),
      });
    }

    return ok(artifact);
  }

  // ── getSynthesis ────────────────────────────────────────────────────────────

  private async _getSynthesis(
    ctx: RequestContext,
    artifactId: string,
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    const authzResult = await this.authz.authorize(ctx, SCHEMA_SYNTHESIS_PERMISSIONS.READ, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to read schema synthesis'));

    const result = await this.artifacts.getById(ctx, artifactId);
    if (result.isErr()) return err(result.error);
    if (!result.value) return err(new NotFoundError(`Schema synthesis artifact ${artifactId} not found`));

    return ok(result.value as SchemaSynthesisArtifact);
  }

  // ── regenerateTable ─────────────────────────────────────────────────────────

  private async _regenerateTable(
    ctx: RequestContext,
    artifactId: string,
    tableId: string,
    feedback?: string,
  ): Promise<Result<SchemaSynthesisArtifact, Error>> {
    const authzResult = await this.authz.authorize(ctx, SCHEMA_SYNTHESIS_PERMISSIONS.REGENERATE, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to regenerate schema'));

    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const artifact = getResult.value;
    const table = artifact.synthesizedSchema.tables.find(t => t.id === tableId);
    if (!table) return err(new NotFoundError(`Table ${tableId} not found in synthesis`));

    const regenResult = await this.generation.run('schema-synthesis.regeneration', {
      tableName: table.name,
      currentColumns: table.columns.map(c => ({ name: c.name, type: c.type, description: c.description })),
      feedback: feedback ?? 'Apply the original entity design with fresh variation',
      entityDescription: table.description,
      databaseDriver: artifact.synthesizedSchema.databaseDriver,
      relatedTables: artifact.synthesizedSchema.tables.filter(t => t.id !== tableId).map(t => t.name),
    });
    if (regenResult.isErr()) return err(regenResult.error);

    const regenData = regenResult.value as { columns: SynthesizedTable['columns']; reasoning: string };
    const updatedTable = { ...table, columns: regenData.columns };
    const updatedTables = artifact.synthesizedSchema.tables.map(t => t.id === tableId ? updatedTable : t);
    const updated: SchemaSynthesisArtifact = {
      ...artifact,
      synthesizedSchema: { ...artifact.synthesizedSchema, tables: updatedTables },
      updatedAt: new Date(),
    };

    await this.audit.write({
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.TABLE_REGENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      meta: auditMeta(ctx, { tableId, feedback }),
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
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.FULL_REGENERATED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      meta: auditMeta(ctx, { feedback }),
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
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.COVERAGE_VALIDATED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      meta: auditMeta(ctx, { coverageRate: coverage.coverageRate }),
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
    const confirmation = { tableId, columnId, accepted, modifiedCategories, confirmedAt: new Date() };
    const updatedPii: PiiDetectionRecord = {
      ...artifact.synthesizedSchema.piiDetectionRecord,
      confirmations: [
        ...artifact.synthesizedSchema.piiDetectionRecord.confirmations.filter(
          c => !(c.tableId === tableId && c.columnId === columnId)
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
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.PII_CONFIRMED,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      meta: auditMeta(ctx, { tableId, columnId, accepted }),
    });

    return ok(updated);
  }

  // ── applyToSchemaDesigner ───────────────────────────────────────────────────

  private async _applyToSchemaDesigner(
    ctx: RequestContext,
    artifactId: string,
    targetSchemaId?: string,
  ): Promise<Result<{ schemaId: string }, Error>> {
    const authzResult = await this.authz.authorize(ctx, SCHEMA_SYNTHESIS_PERMISSIONS.APPLY, {
      type: 'workspace', id: ctx.workspaceId,
    });
    if (authzResult.isErr()) return err(new ForbiddenError('Not allowed to apply schema synthesis'));

    const getResult = await this._getSynthesis(ctx, artifactId);
    if (getResult.isErr()) return err(getResult.error);

    const schemaId = targetSchemaId ?? `schema_from_synthesis_${artifactId}`;

    await this.audit.write({
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.APPLIED_TO_DESIGNER,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      meta: auditMeta(ctx, { schemaId }),
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
    const updated: SchemaSynthesisArtifact = { ...artifact, status: 'pending_approval', updatedAt: new Date() };

    await this.pipeline.submitForApproval(ctx, { type: 'schema_synthesis', id: artifactId });

    await this.audit.write({
      event: SCHEMA_SYNTHESIS_AUDIT_EVENTS.SUBMITTED_FOR_APPROVAL,
      actor: toAuditActor(ctx),
      resource: { type: 'schema_synthesis', id: artifactId },
      meta: auditMeta(ctx, {}),
    });

    return ok(updated);
  }
}
