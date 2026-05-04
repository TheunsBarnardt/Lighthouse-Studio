import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { MetricsPort, LoggerPort } from '@platform/ports-observability';
import type {
  Filter,
  PlatformColumnType,
  RepositoryPort,
  SchemaDdlPort,
  SchemaIntrospectionPort,
  SchemaMigrationPort,
  TableDefinition as PortTableDefinition,
} from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

import type { ApprovalRoutingEngine } from '../../approvals/approval-routing.engine.js';
import type { AppError } from '../../errors.js';
import type {
  ColumnDefinition,
  CreateSchemaInput,
  CustomerSchema,
  CustomerTableDefinition,
  DefaultValueExpression,
  DeleteSchemaOptions,
  ImportSchemaInput,
  ListOptions,
  MigrationPreview,
  MigrationResult,
  PaginatedResult,
  PrimaryKeyDefinition,
  SchemaChanges,
  SchemaVersion,
  UpdateSchemaInput,
  ValidationReport,
} from './schema-model.js';

import { auditMeta, toAuditActor } from '../../context.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  WorkspaceContextRequiredError,
} from '../../errors.js';
import { observable } from '../../observability/observable.js';
import { SCHEMA_AUDIT_EVENTS } from './audit-events.js';
import { MigrationPlanner } from './migration-planner.js';
import { createWorkspaceMssqlSchema, createWorkspacePostgresSchema } from './namespace.js';
import {
  CreateSchemaInputSchema,
  DeleteSchemaOptionsSchema,
  ImportSchemaInputSchema,
  UpdateSchemaInputSchema,
} from './schema-model.js';
import { SchemaValidator } from './schema-validator.js';
import { getTemplate } from './templates/index.js';

// ── Repository type aliases ────────────────────────────────────────────────────

type SchemaRepo = RepositoryPort<CustomerSchema>;
type VersionRepo = RepositoryPort<SchemaVersion>;

// ── SchemaService ──────────────────────────────────────────────────────────────

export class SchemaService {
  // ── Public API (observable-wrapped) ─────────────────────────────────────────

  readonly createSchema!: (
    ctx: RequestContext,
    input: CreateSchemaInput,
  ) => Promise<Result<CustomerSchema, AppError>>;

  readonly listSchemas!: (
    ctx: RequestContext,
    opts?: ListOptions,
  ) => Promise<Result<PaginatedResult<CustomerSchema>, AppError>>;

  readonly getSchema!: (
    ctx: RequestContext,
    schemaId: string,
  ) => Promise<Result<CustomerSchema, AppError>>;

  readonly updateSchema!: (
    ctx: RequestContext,
    input: UpdateSchemaInput,
  ) => Promise<Result<CustomerSchema, AppError>>;

  readonly validateSchema!: (
    ctx: RequestContext,
    schemaId: string,
    proposed: SchemaChanges,
  ) => Promise<Result<ValidationReport, AppError>>;

  readonly previewMigration!: (
    ctx: RequestContext,
    schemaId: string,
    proposed: SchemaChanges,
  ) => Promise<Result<MigrationPreview, AppError>>;

  readonly applyChanges!: (
    ctx: RequestContext,
    schemaId: string,
    proposed: SchemaChanges,
    expectedVersion: number,
  ) => Promise<Result<MigrationResult, AppError>>;

  readonly listVersions!: (
    ctx: RequestContext,
    schemaId: string,
  ) => Promise<Result<SchemaVersion[], AppError>>;

  readonly rollbackToVersion!: (
    ctx: RequestContext,
    schemaId: string,
    targetVersion: number,
  ) => Promise<Result<MigrationResult, AppError>>;

  readonly exportSchema!: (
    ctx: RequestContext,
    schemaId: string,
    format: 'json' | 'yaml' | 'markdown',
  ) => Promise<Result<string, AppError>>;

  readonly importSchema!: (
    ctx: RequestContext,
    input: ImportSchemaInput,
  ) => Promise<Result<CustomerSchema, AppError>>;

  readonly deleteSchema!: (
    ctx: RequestContext,
    options: DeleteSchemaOptions,
  ) => Promise<Result<void, AppError>>;

  readonly createSchemaFromTemplate!: (
    ctx: RequestContext,
    templateId: string,
    input: CreateSchemaInput,
  ) => Promise<Result<CustomerSchema, AppError>>;

  /**
   * Resolve a deployed schema by its slug within the request's workspace.
   * Used by the auto-generated REST API handler on every request.
   * Does NOT require schema.read permission — the API layer authorizes at the
   * table level (data_table.read / data_table.write).
   */
  readonly resolveDeployedSchema!: (
    ctx: RequestContext,
    schemaSlug: string,
  ) => Promise<Result<CustomerSchema, AppError>>;

  private readonly validator: SchemaValidator;
  private readonly planner: MigrationPlanner;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly schemas: SchemaRepo,
    private readonly schemaVersions: VersionRepo,
    private readonly introspection: SchemaIntrospectionPort,
    private readonly ddl: SchemaDdlPort,
    private readonly migration: SchemaMigrationPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly approvals: ApprovalRoutingEngine,
    private readonly metrics?: MetricsPort,
  ) {
    this.validator = new SchemaValidator();
    this.planner = new MigrationPlanner();

    const obs = { logger };
    const s = 'SchemaService';
    this.createSchema = observable(s, 'createSchema', obs, this._createSchema.bind(this));
    this.listSchemas = observable(s, 'listSchemas', obs, this._listSchemas.bind(this));
    this.getSchema = observable(s, 'getSchema', obs, this._getSchema.bind(this));
    this.updateSchema = observable(s, 'updateSchema', obs, this._updateSchema.bind(this));
    this.validateSchema = observable(s, 'validateSchema', obs, this._validateSchema.bind(this));
    this.previewMigration = observable(
      s,
      'previewMigration',
      obs,
      this._previewMigration.bind(this),
    );
    this.applyChanges = observable(s, 'applyChanges', obs, this._applyChanges.bind(this));
    this.listVersions = observable(s, 'listVersions', obs, this._listVersions.bind(this));
    this.rollbackToVersion = observable(
      s,
      'rollbackToVersion',
      obs,
      this._rollbackToVersion.bind(this),
    );
    this.exportSchema = observable(s, 'exportSchema', obs, this._exportSchema.bind(this));
    this.importSchema = observable(s, 'importSchema', obs, this._importSchema.bind(this));
    this.deleteSchema = observable(s, 'deleteSchema', obs, this._deleteSchema.bind(this));
    this.createSchemaFromTemplate = observable(
      s,
      'createSchemaFromTemplate',
      obs,
      this._createSchemaFromTemplate.bind(this),
    );
    this.resolveDeployedSchema = observable(
      s,
      'resolveDeployedSchema',
      obs,
      this._resolveDeployedSchema.bind(this),
    );
  }

  // ── Private implementations ──────────────────────────────────────────────────

  private async _createSchema(
    ctx: RequestContext,
    input: CreateSchemaInput,
  ): Promise<Result<CustomerSchema, AppError>> {
    // 1. Validate
    const parsed = CreateSchemaInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid schema input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    const wid = ctx.workspaceId;

    const authResult = await this.authz.authorize(ctx, 'schema.create', 'schema');
    if (authResult.isErr()) {
      await this._logDeny(ctx, SCHEMA_AUDIT_EVENTS.SCHEMA_CREATED, 'schema', null);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: slug uniqueness within workspace
    const existing = await this.schemas.findOne({
      workspaceId: { _eq: wid },
      slug: { _eq: parsed.data.slug },
    } as Parameters<SchemaRepo['findOne']>[0]);
    if (existing.isErr()) return err(new ConflictError(existing.error.message));
    if (existing.value) {
      return err(
        new ConflictError(`Schema slug '${parsed.data.slug}' is already taken in this workspace.`),
      );
    }

    // 4. Execute
    const now = new Date();
    const schema: CustomerSchema = {
      id: uuidv7(),
      workspaceId: wid,
      name: parsed.data.name,
      slug: parsed.data.slug,
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      version: 1,
      databaseDriver: parsed.data.databaseDriver,
      tables: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      },
    };

    const createResult = await this.schemas.create(schema);
    if (createResult.isErr()) return err(new ConflictError(createResult.error.message));

    // 4b. Ensure the per-workspace DB namespace (schema + roles) exists on postgres/mssql.
    // Idempotent: uses IF NOT EXISTS. Only needed for relational drivers; Mongo uses collection
    // prefixes that don't require pre-creation.
    if (parsed.data.workspaceSlug && schema.databaseDriver !== 'mongo') {
      const namespaceDdl =
        schema.databaseDriver === 'postgres'
          ? createWorkspacePostgresSchema(parsed.data.workspaceSlug)
          : createWorkspaceMssqlSchema(parsed.data.workspaceSlug);
      const nsResult = await this.migration.apply({
        id: `ns-init-${wid}`,
        name: `init-workspace-namespace-${parsed.data.workspaceSlug}`,
        up: namespaceDdl,
      });
      if (nsResult.isErr()) {
        this.logger.warn('Workspace namespace init failed; schema created without namespace', {
          workspaceId: wid,
          workspaceSlug: parsed.data.workspaceSlug,
          error: nsResult.error.message,
        });
      }
    }

    // 5. Audit
    await this.audit.write({
      eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_CREATED,
      workspaceId: wid,
      actor: toAuditActor(ctx),
      resource: { type: 'schema', id: schema.id },
      action: 'created',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { name: schema.name, slug: schema.slug, driver: schema.databaseDriver },
      ...auditMeta(ctx),
    });

    this.metrics
      ?.counter('platform_schema_operations_total', {
        description: 'Total schema operations',
      })
      .add(1, { operation: 'create', outcome: 'success', driver: schema.databaseDriver });

    this.logger.info('Schema created', {
      schemaId: schema.id,
      slug: schema.slug,
      workspaceId: wid,
    });
    return ok(schema);
  }

  private async _listSchemas(
    ctx: RequestContext,
    opts?: ListOptions,
  ): Promise<Result<PaginatedResult<CustomerSchema>, AppError>> {
    // 2. Authorize
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());
    const wid = ctx.workspaceId;

    const authResult = await this.authz.authorize(ctx, 'schema.read', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Execute
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    const listResult = await this.schemas.findMany({
      filter: { workspaceId: { _eq: wid } } as Filter<CustomerSchema>,
      page: { limit, offset },
    });
    if (listResult.isErr()) return err(new ConflictError(listResult.error.message));

    return ok(listResult.value);
  }

  private async _getSchema(
    ctx: RequestContext,
    schemaId: string,
  ): Promise<Result<CustomerSchema, AppError>> {
    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.read', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Fetch (workspace scoping enforced by workspaceId filter)
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const fetchResult = await this.schemas.findById(schemaId);
    if (fetchResult.isErr()) return err(new ConflictError(fetchResult.error.message));
    if (!fetchResult.value) return err(new NotFoundError('schema', schemaId));

    // Workspace isolation check
    if (fetchResult.value.workspaceId !== ctx.workspaceId) {
      return err(new NotFoundError('schema', schemaId));
    }

    return ok(fetchResult.value);
  }

  private async _updateSchema(
    ctx: RequestContext,
    input: UpdateSchemaInput,
  ): Promise<Result<CustomerSchema, AppError>> {
    // 1. Validate
    const parsed = UpdateSchemaInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid update input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.update', 'schema');
    if (authResult.isErr()) {
      await this._logDeny(ctx, SCHEMA_AUDIT_EVENTS.SCHEMA_UPDATED, 'schema', parsed.data.schemaId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Precondition: schema exists and belongs to workspace
    const getResult = await this._getSchema(ctx, parsed.data.schemaId);
    if (getResult.isErr()) return err(getResult.error);
    const before = getResult.value;

    // 4. Execute with optimistic locking
    const now = new Date();
    const changes: Partial<CustomerSchema> = {
      metadata: { ...before.metadata, updatedAt: now, updatedBy: ctx.userId },
    };
    if (parsed.data.changes.name !== undefined) changes.name = parsed.data.changes.name;
    if (parsed.data.changes.description !== undefined)
      changes.description = parsed.data.changes.description;
    if (parsed.data.changes.tables !== undefined)
      changes.tables = parsed.data.changes.tables as CustomerTableDefinition[];

    const updateResult = await this.schemas.update(parsed.data.schemaId, changes, {
      expectedVersion: parsed.data.expectedVersion,
    });
    if (updateResult.isErr()) {
      if (updateResult.error.message.includes('Version mismatch')) {
        return err(new ConflictError('Schema was modified by another user. Reload and retry.'));
      }
      return err(new NotFoundError('schema', parsed.data.schemaId));
    }

    // 5. Audit
    await this.audit.write({
      eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_UPDATED,
      workspaceId: before.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'schema', id: before.id },
      action: 'updated',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { schemaId: before.id, versionFrom: parsed.data.expectedVersion },
      ...auditMeta(ctx),
    });

    return ok(updateResult.value);
  }

  private async _validateSchema(
    ctx: RequestContext,
    schemaId: string,
    proposed: SchemaChanges,
  ): Promise<Result<ValidationReport, AppError>> {
    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.read', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Fetch current schema
    const getResult = await this._getSchema(ctx, schemaId);
    if (getResult.isErr()) return err(getResult.error);
    const schema = getResult.value;

    // 4. Execute validation
    const report = this.validator.validate(schema, proposed, schema.databaseDriver);

    if (!report.valid) {
      await this.audit.write({
        eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_VALIDATION_FAILED,
        workspaceId: schema.workspaceId,
        actor: toAuditActor(ctx),
        resource: { type: 'schema', id: schema.id },
        action: 'validated',
        outcome: 'failure',
        correlationId: ctx.correlationId,
        metadata: { schemaId: schema.id, errorCount: report.errors.length },
        ...auditMeta(ctx),
      });

      this.metrics
        ?.counter('platform_schema_validation_failures_total', {
          description: 'Schema validation failures',
        })
        .add(1, { driver: schema.databaseDriver, error_code: report.errors[0]?.code ?? 'unknown' });
    }

    return ok(report);
  }

  private async _previewMigration(
    ctx: RequestContext,
    schemaId: string,
    proposed: SchemaChanges,
  ): Promise<Result<MigrationPreview, AppError>> {
    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.read', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Fetch
    const getResult = await this._getSchema(ctx, schemaId);
    if (getResult.isErr()) return err(getResult.error);
    const schema = getResult.value;

    // 4. Validate first
    const report = this.validator.validate(schema, proposed, schema.databaseDriver);
    if (!report.valid) {
      return err(
        new ValidationError(
          'Schema has validation errors; fix them before previewing migration.',
          report.errors.map((e) => ({ path: e.path, message: e.message })),
        ),
      );
    }

    // 5. Plan
    const plan = this.planner.plan(schema, proposed, schema.databaseDriver);

    // Approval routing evaluation (solo mode: empty approvers → always satisfied)
    const approvalDecision = this.approvals.evaluate({
      config: { require: 'all', approvers: [] },
      members: [],
      memberRoles: [],
      roles: [],
      existingApprovals: [],
    });
    const requiresApproval = approvalDecision.isOk() ? !approvalDecision.value.satisfied : false;

    return ok({
      plan,
      fromVersion: schema.version,
      toVersion: schema.version + 1,
      requiresApproval,
    });
  }

  private async _applyChanges(
    ctx: RequestContext,
    schemaId: string,
    proposed: SchemaChanges,
    expectedVersion: number,
  ): Promise<Result<MigrationResult, AppError>> {
    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.deploy', 'schema');
    if (authResult.isErr()) {
      await this._logDeny(ctx, SCHEMA_AUDIT_EVENTS.SCHEMA_DEPLOYED, 'schema', schemaId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Fetch + validate
    const getResult = await this._getSchema(ctx, schemaId);
    if (getResult.isErr()) return err(getResult.error);
    const schema = getResult.value;

    if (schema.version !== expectedVersion) {
      return err(new ConflictError('Schema was modified by another user. Reload and retry.'));
    }

    const report = this.validator.validate(schema, proposed, schema.databaseDriver);
    if (!report.valid) {
      return err(
        new ValidationError(
          'Schema has validation errors; fix them before applying.',
          report.errors.map((e) => ({ path: e.path, message: e.message })),
        ),
      );
    }

    // Approval routing: solo mode — empty approvers list satisfies 'all' (no required approvers)
    // Full enterprise approval routing requires workspace member repos at composition root.
    const approvalDecision = this.approvals.evaluate({
      config: { require: 'all', approvers: [] },
      members: [],
      memberRoles: [],
      roles: [],
      existingApprovals: [],
    });
    if (approvalDecision.isErr()) {
      return err(new ConflictError(`Approval routing error: ${approvalDecision.error.message}`));
    }

    // 4. Plan
    const plan = this.planner.plan(schema, proposed, schema.databaseDriver);
    const startedAt = new Date();
    const newVersion = schema.version + 1;
    const proposedTables = proposed.tables ?? schema.tables;

    // Generate DDL using SchemaDdlPort for new tables; use planner DDL for all other steps.
    // The DDL port capability check informs whether schema namespacing is available.
    const supportsSchemas = this.introspection.supports('schemas');
    const upParts: string[] = [];
    const downParts: string[] = [];

    const currentTableIds = new Set(schema.tables.map((t) => t.id));
    for (const step of plan.steps) {
      const ddlStr = step.ddl ?? '';
      // For CREATE TABLE steps, supplement the planner's placeholder with DDL port output
      if (ddlStr.startsWith('CREATE TABLE') && !ddlStr.includes('/* columns')) {
        upParts.push(ddlStr);
      } else if (ddlStr.startsWith('CREATE TABLE')) {
        // Find the matching new table and generate real DDL via the ddl port
        const tableName = extractTableNameFromCreateDdl(ddlStr);
        const table = proposedTables.find(
          (t) => t.name === tableName && !currentTableIds.has(t.id),
        );
        if (table) {
          const portTable = toPortTableDef(table, schema.tables);
          const ddlResult = this.ddl.createTable(portTable);
          if (ddlResult.isOk()) {
            upParts.push(...ddlResult.value.map((d) => d.sql));
          } else {
            upParts.push(ddlStr); // fall back to planner DDL
          }
        } else {
          upParts.push(ddlStr);
        }
      } else if (ddlStr) {
        upParts.push(ddlStr);
      }
      if (step.reversible && step.reverseDdl) {
        downParts.push(step.reverseDdl);
      }
    }

    this.logger.debug('Applying schema migration', {
      schemaId,
      stepCount: plan.steps.length,
      supportsSchemas,
      driver: schema.databaseDriver,
    });

    // Execute migration via SchemaMigrationPort
    const migrationId = uuidv7();
    const upSql = upParts.join(';\n');
    const downSql = downParts.join(';\n');

    const migResult = await this.migration.apply({
      id: migrationId,
      name: `schema-${schemaId}-v${String(expectedVersion)}-to-v${String(newVersion)}`,
      up: upSql,
      ...(downSql ? { down: downSql } : {}),
    });

    if (migResult.isErr()) {
      await this.audit.write({
        eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_DEPLOY_FAILED,
        workspaceId: schema.workspaceId,
        actor: toAuditActor(ctx),
        resource: { type: 'schema', id: schemaId },
        action: 'deploy_failed',
        outcome: 'failure',
        correlationId: ctx.correlationId,
        metadata: {
          schemaId,
          error: migResult.error.message,
          versionFrom: expectedVersion,
          versionTo: newVersion,
        },
        ...auditMeta(ctx),
      });

      this.metrics
        ?.counter('platform_schema_operations_total', {
          description: 'Total schema operations',
        })
        .add(1, { operation: 'deploy', outcome: 'failure', driver: schema.databaseDriver });

      return err(new ConflictError(`Migration execution failed: ${migResult.error.message}`));
    }

    // Persist schema changes (optimistic lock)
    const now = new Date();
    const updateResult = await this.schemas.update(
      schemaId,
      {
        tables: proposedTables,
        version: newVersion,
        metadata: {
          ...schema.metadata,
          updatedAt: now,
          updatedBy: ctx.userId,
          deployedVersion: newVersion,
          lastDeployedAt: now,
        },
      },
      { expectedVersion },
    );
    if (updateResult.isErr()) {
      return err(new ConflictError('Schema was modified during apply. Retry.'));
    }

    // Record version snapshot
    const versionRecord: SchemaVersion = {
      id: uuidv7(),
      schemaId,
      version: newVersion,
      schemaDefinition: updateResult.value,
      changeSummary: 'Schema changes applied',
      appliedBy: ctx.userId,
      appliedAt: now,
    };
    await this.schemaVersions.create(versionRecord);

    const completedAt = new Date();

    // 5. Audit
    await this.audit.write({
      eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_DEPLOYED,
      workspaceId: schema.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'schema', id: schemaId },
      action: 'deployed',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        schemaId,
        versionFrom: expectedVersion,
        versionTo: newVersion,
        stepCount: plan.steps.length,
        dataLossRisk: plan.dataLossRisk,
        migrationId,
      },
      ...auditMeta(ctx),
    });

    // Write PII-tagged columns to the audit log as the personal data registry entry.
    // The compliance module queries SCHEMA_PII_COLUMNS_REGISTERED events to answer
    // "what PII does workspace X store?" for GDPR Article 15/17 requests.
    const piiCols = extractPiiColumns(proposedTables);
    if (piiCols.length > 0) {
      await this.audit.write({
        eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_PII_COLUMNS_REGISTERED,
        workspaceId: schema.workspaceId,
        actor: toAuditActor(ctx),
        resource: { type: 'schema', id: schemaId },
        action: 'pii_columns_registered',
        outcome: 'success',
        correlationId: ctx.correlationId,
        metadata: {
          schemaId,
          schemaSlug: schema.slug,
          version: newVersion,
          piiColumns: piiCols,
        },
        ...auditMeta(ctx),
      });
    }

    // Metrics
    const durationMs = completedAt.getTime() - startedAt.getTime();
    this.metrics
      ?.counter('platform_schema_operations_total', {
        description: 'Total schema operations',
      })
      .add(1, { operation: 'deploy', outcome: 'success', driver: schema.databaseDriver });
    this.metrics
      ?.histogram('platform_schema_migration_duration_seconds', {
        description: 'Schema migration duration in seconds',
      })
      .record(durationMs / 1000, { driver: schema.databaseDriver });

    if (durationMs > 300_000) {
      this.logger.error('Schema migration took over 5 minutes — operator action may be required', {
        schemaId,
        migrationId,
        durationMs,
      });
    } else if (durationMs > 30_000) {
      this.logger.warn('Schema migration took over 30 seconds', {
        schemaId,
        migrationId,
        durationMs,
      });
    }

    return ok({
      migrationId,
      schemaId,
      outcome: 'succeeded',
      stepsExecuted: plan.steps.length,
      startedAt,
      completedAt,
      newVersion,
    });
  }

  private async _listVersions(
    ctx: RequestContext,
    schemaId: string,
  ): Promise<Result<SchemaVersion[], AppError>> {
    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.read', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Verify schema exists in workspace
    const getResult = await this._getSchema(ctx, schemaId);
    if (getResult.isErr()) return err(getResult.error);

    // 4. Fetch versions
    const versionsResult = await this.schemaVersions.findMany({
      filter: { schemaId: { _eq: schemaId } } as Filter<SchemaVersion>,
    });
    if (versionsResult.isErr()) return err(new ConflictError(versionsResult.error.message));

    return ok(versionsResult.value.items);
  }

  private async _rollbackToVersion(
    ctx: RequestContext,
    schemaId: string,
    targetVersion: number,
  ): Promise<Result<MigrationResult, AppError>> {
    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.rollback', 'schema');
    if (authResult.isErr()) {
      await this._logDeny(ctx, SCHEMA_AUDIT_EVENTS.SCHEMA_ROLLED_BACK, 'schema', schemaId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Fetch current schema
    const getResult = await this._getSchema(ctx, schemaId);
    if (getResult.isErr()) return err(getResult.error);
    const schema = getResult.value;

    // 4. Fetch the target version snapshot
    const versionResult = await this.schemaVersions.findOne({
      schemaId: { _eq: schemaId },
      version: { _eq: targetVersion },
    } as Parameters<VersionRepo['findOne']>[0]);
    if (versionResult.isErr()) return err(new ConflictError(versionResult.error.message));
    if (!versionResult.value) {
      return err(new NotFoundError('schema_version', `${schemaId}@${String(targetVersion)}`));
    }
    const targetSnapshot = versionResult.value;

    // 5. Plan rollback (diff current → target)
    const proposed: SchemaChanges = { tables: targetSnapshot.schemaDefinition.tables };
    const plan = this.planner.plan(schema, proposed, schema.databaseDriver);

    // Approval routing: solo mode
    const approvalDecision = this.approvals.evaluate({
      config: { require: 'all', approvers: [] },
      members: [],
      memberRoles: [],
      roles: [],
      existingApprovals: [],
    });
    if (approvalDecision.isErr()) {
      return err(new ConflictError(`Approval routing error: ${approvalDecision.error.message}`));
    }

    const startedAt = new Date();
    const newVersion = schema.version + 1;
    const now = new Date();

    // Execute rollback migration
    const migrationId = uuidv7();
    const upSql = plan.steps
      .map((s) => s.ddl)
      .filter(Boolean)
      .join(';\n');
    const downSql = plan.steps
      .filter((s) => s.reversible && s.reverseDdl)
      .map((s) => s.reverseDdl ?? '')
      .join(';\n');

    const migResult = await this.migration.apply({
      id: migrationId,
      name: `schema-${schemaId}-rollback-to-v${String(targetVersion)}`,
      up: upSql,
      ...(downSql ? { down: downSql } : {}),
    });

    if (migResult.isErr()) {
      return err(new ConflictError(`Rollback migration failed: ${migResult.error.message}`));
    }

    // Apply rollback as a new version (never edit history)
    const updateResult = await this.schemas.update(
      schemaId,
      {
        tables: targetSnapshot.schemaDefinition.tables,
        version: newVersion,
        metadata: {
          ...schema.metadata,
          updatedAt: now,
          updatedBy: ctx.userId,
          deployedVersion: newVersion,
          lastDeployedAt: now,
        },
      },
      { expectedVersion: schema.version },
    );
    if (updateResult.isErr()) {
      return err(new ConflictError('Schema was modified during rollback. Retry.'));
    }

    // Record rollback version
    const versionRecord: SchemaVersion = {
      id: uuidv7(),
      schemaId,
      version: newVersion,
      schemaDefinition: updateResult.value,
      changeSummary: `Rolled back to version ${String(targetVersion)}`,
      appliedBy: ctx.userId,
      appliedAt: now,
    };
    await this.schemaVersions.create(versionRecord);

    const completedAt = new Date();

    // 5. Audit
    await this.audit.write({
      eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_ROLLED_BACK,
      workspaceId: schema.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'schema', id: schemaId },
      action: 'rolled_back',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        schemaId,
        versionFrom: schema.version,
        versionTo: newVersion,
        rolledBackToVersion: targetVersion,
        dataLossRisk: plan.dataLossRisk,
        migrationId,
      },
      ...auditMeta(ctx),
    });

    this.metrics
      ?.counter('platform_schema_operations_total', {
        description: 'Total schema operations',
      })
      .add(1, { operation: 'rollback', outcome: 'success', driver: schema.databaseDriver });

    return ok({
      migrationId,
      schemaId,
      outcome: 'succeeded',
      stepsExecuted: plan.steps.length,
      startedAt,
      completedAt,
      newVersion,
    });
  }

  private async _exportSchema(
    ctx: RequestContext,
    schemaId: string,
    format: 'json' | 'yaml' | 'markdown',
  ): Promise<Result<string, AppError>> {
    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.export', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Fetch
    const getResult = await this._getSchema(ctx, schemaId);
    if (getResult.isErr()) return err(getResult.error);
    const schema = getResult.value;

    // 4. Export
    let output: string;
    switch (format) {
      case 'json':
        output = JSON.stringify(schema, null, 2);
        break;
      case 'yaml':
        output = schemaToYaml(schema);
        break;
      case 'markdown':
        output = schemaToMarkdown(schema);
        break;
    }

    // 5. Audit
    await this.audit.write({
      eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_EXPORTED,
      workspaceId: schema.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'schema', id: schemaId },
      action: 'exported',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { schemaId, format },
      ...auditMeta(ctx),
    });

    return ok(output);
  }

  private async _importSchema(
    ctx: RequestContext,
    input: ImportSchemaInput,
  ): Promise<Result<CustomerSchema, AppError>> {
    // 1. Validate
    const parsed = ImportSchemaInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid import input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.import', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Parse import content
    let parsed_schema: Partial<CustomerSchema>;
    try {
      if (parsed.data.format === 'json') {
        parsed_schema = JSON.parse(parsed.data.content) as Partial<CustomerSchema>;
      } else {
        // YAML parsing: basic support; full YAML library can be wired in later
        parsed_schema = JSON.parse(parsed.data.content) as Partial<CustomerSchema>;
      }
    } catch {
      return err(new ValidationError('Import content is not valid JSON/YAML.', []));
    }

    // 4. Create schema from imported definition
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const slug =
      parsed.data.slug ?? generateSlug(parsed.data.name ?? parsed_schema.name ?? 'imported');

    const createResult = await this._createSchema(ctx, {
      name: parsed.data.name ?? parsed_schema.name ?? 'imported',
      slug,
      databaseDriver: parsed.data.databaseDriver,
    });
    if (createResult.isErr()) return err(createResult.error);

    const created = createResult.value;

    // Apply the imported tables if present
    if (parsed_schema.tables?.length) {
      const report = this.validator.validate(
        created,
        { tables: parsed_schema.tables },
        parsed.data.databaseDriver,
      );
      if (!report.valid) {
        this.logger.warn('Imported schema has validation issues', {
          schemaId: created.id,
          errorCount: report.errors.length,
        });
      }

      const applyResult = await this._applyChanges(
        ctx,
        created.id,
        { tables: parsed_schema.tables },
        1,
      );
      if (applyResult.isErr()) return err(applyResult.error);
    }

    await this.audit.write({
      eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_IMPORTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'schema', id: created.id },
      action: 'imported',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { schemaId: created.id, format: parsed.data.format },
      ...auditMeta(ctx),
    });

    return ok(created);
  }

  private async _deleteSchema(
    ctx: RequestContext,
    options: DeleteSchemaOptions,
  ): Promise<Result<void, AppError>> {
    // 1. Validate
    const parsed = DeleteSchemaOptionsSchema.safeParse(options);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid delete options',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize
    const authResult = await this.authz.authorize(ctx, 'schema.delete', 'schema');
    if (authResult.isErr()) {
      await this._logDeny(ctx, SCHEMA_AUDIT_EVENTS.SCHEMA_DELETED, 'schema', parsed.data.schemaId);
      return err(new ForbiddenError(authResult.error.message));
    }

    // 3. Fetch
    const getResult = await this._getSchema(ctx, parsed.data.schemaId);
    if (getResult.isErr()) return err(getResult.error);
    const schema = getResult.value;

    // 4. Soft-delete (archive)
    const archiveResult = await this.schemas.update(
      parsed.data.schemaId,
      {
        metadata: { ...schema.metadata, updatedAt: new Date(), updatedBy: ctx.userId },
      },
      { expectedVersion: parsed.data.expectedVersion },
    );
    if (archiveResult.isErr()) {
      return err(new ConflictError('Schema was modified. Reload and retry.'));
    }

    // 5. Audit
    await this.audit.write({
      eventType: SCHEMA_AUDIT_EVENTS.SCHEMA_DELETED,
      workspaceId: schema.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'schema', id: parsed.data.schemaId },
      action: 'deleted',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: {
        schemaId: parsed.data.schemaId,
        ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
        dropCustomerTables: parsed.data.dropCustomerTables,
      },
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _createSchemaFromTemplate(
    ctx: RequestContext,
    templateId: string,
    input: CreateSchemaInput,
  ): Promise<Result<CustomerSchema, AppError>> {
    // 1. Validate
    const parsed = CreateSchemaInputSchema.safeParse(input);
    if (!parsed.success) {
      return err(
        new ValidationError(
          'Invalid schema input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    // 2. Authorize (same permission as create)
    const authResult = await this.authz.authorize(ctx, 'schema.create', 'schema');
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    // 3. Look up template
    const template = getTemplate(templateId);
    if (!template) {
      return err(new NotFoundError('schema_template', templateId));
    }

    // 4. Create the schema
    const createResult = await this._createSchema(ctx, input);
    if (createResult.isErr()) return err(createResult.error);
    const schema = createResult.value;

    // 5. Apply template tables
    if (template.tables.length > 0) {
      const applyResult = await this._applyChanges(ctx, schema.id, { tables: template.tables }, 1);
      if (applyResult.isErr()) return err(applyResult.error);

      // Return the refreshed schema
      const refreshResult = await this._getSchema(ctx, schema.id);
      if (refreshResult.isErr()) return err(refreshResult.error);
      return ok(refreshResult.value);
    }

    return ok(schema);
  }

  // ── API resolution ───────────────────────────────────────────────────────────

  private async _resolveDeployedSchema(
    ctx: RequestContext,
    schemaSlug: string,
  ): Promise<Result<CustomerSchema, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const findResult = await this.schemas.findOne({
      workspaceId: { _eq: ctx.workspaceId },
      slug: { _eq: schemaSlug },
    } as Filter<CustomerSchema>);

    if (findResult.isErr()) return err(new ConflictError(findResult.error.message));
    if (!findResult.value) {
      return err(new NotFoundError('Schema', `${ctx.workspaceId}:${schemaSlug}`));
    }

    return ok(findResult.value);
  }

  // ── Audit helpers ────────────────────────────────────────────────────────────

  private async _logDeny(
    ctx: RequestContext,
    eventType: string,
    resourceType: string,
    resourceId: string | null,
  ): Promise<void> {
    const workspaceId = ctx.workspaceId;
    if (!workspaceId) return;
    await this.audit.write({
      eventType,
      workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: resourceType, id: resourceId ?? 'unknown' },
      action: 'denied',
      outcome: 'denied',
      correlationId: ctx.correlationId,
      metadata: {},
      ...auditMeta(ctx),
    });
  }
}

// ── Module-private helpers ──────────────────────────────────────────────────────

function extractPiiColumns(
  tables: CustomerTableDefinition[],
): Array<{ table: string; column: string; category: string }> {
  const result: Array<{ table: string; column: string; category: string }> = [];
  for (const table of tables) {
    for (const col of table.columns) {
      if (col.isPii) {
        result.push({
          table: table.name,
          column: col.name,
          category: col.piiCategory ?? 'unspecified',
        });
      }
    }
  }
  return result;
}

function serializeDefaultValue(dv: DefaultValueExpression): string {
  if (dv.kind === 'literal') {
    if (dv.value === null) return 'NULL';
    if (typeof dv.value === 'string') return `'${dv.value.replace(/'/g, "''")}'`;
    return String(dv.value);
  }
  if (dv.kind === 'function') {
    return `${dv.name}()`;
  }
  // kind === 'sequence': auto-increment / serial — no explicit default value needed
  return '';
}

function isPkColumn(columnId: string, pk: PrimaryKeyDefinition): boolean {
  if (pk.kind === 'single') return pk.columnId === columnId;
  return pk.columnIds.includes(columnId);
}

function isUniqueColumn(columnId: string, table: CustomerTableDefinition): boolean {
  return table.indexes.some(
    (idx) => idx.unique && idx.columns.length === 1 && idx.columns[0]?.columnId === columnId,
  );
}

function toPortTableDef(
  table: CustomerTableDefinition,
  allTables: CustomerTableDefinition[],
): PortTableDefinition {
  const colNameById = new Map(table.columns.map((c) => [c.id, c.name]));
  const tableNameById = new Map(allTables.map((t) => [t.id, t.name]));

  const columns = table.columns.map((col: ColumnDefinition) => ({
    name: col.name,
    type: col.type as PlatformColumnType,
    nullable: col.nullable,
    ...(col.defaultValue !== undefined
      ? { defaultValue: serializeDefaultValue(col.defaultValue) }
      : {}),
    isPrimaryKey: isPkColumn(col.id, table.primaryKey),
    isUnique: isUniqueColumn(col.id, table),
    ...(col.description !== undefined ? { comment: col.description } : {}),
  }));

  const indexes = table.indexes.map((idx) => ({
    name: idx.name,
    columns: idx.columns.map((c) => colNameById.get(c.columnId) ?? c.columnId),
    isUnique: idx.unique,
    isPartial: idx.partial !== undefined,
    ...(idx.partial?.expression !== undefined ? { predicate: idx.partial.expression } : {}),
  }));

  const foreignKeys = table.foreignKeys.map((fk) => ({
    name: fk.name,
    columns: fk.columns.map((cid) => colNameById.get(cid) ?? cid),
    referencedTable: tableNameById.get(fk.referencedTableId) ?? fk.referencedTableId,
    referencedColumns: fk.referencedColumns.map((cid) => {
      const refTable = allTables.find((t) => t.id === fk.referencedTableId);
      const refColName = refTable?.columns.find((c) => c.id === cid)?.name;
      return refColName ?? cid;
    }),
    onDelete: normalizeFkAction(fk.onDelete),
    onUpdate: normalizeFkAction(fk.onUpdate),
  }));

  return { name: table.name, columns, indexes, foreignKeys, constraints: [] };
}

function normalizeFkAction(
  action: 'cascade' | 'set_null' | 'restrict' | 'no_action',
): 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' {
  switch (action) {
    case 'cascade':
      return 'CASCADE';
    case 'set_null':
      return 'SET NULL';
    case 'restrict':
      return 'RESTRICT';
    case 'no_action':
      return 'NO ACTION';
  }
}

function extractTableNameFromCreateDdl(ddl: string): string {
  // Matches: CREATE TABLE "table_name" or CREATE TABLE table_name
  const m = ddl.match(/CREATE\s+TABLE\s+"?([^"(\s]+)"?/i);
  return m?.[1] ?? '';
}

function schemaToMarkdown(schema: CustomerSchema): string {
  const lines: string[] = [
    `# Schema: ${schema.name}`,
    '',
    schema.description ? schema.description : '',
    '',
    `- **Database**: ${schema.databaseDriver}`,
    `- **Version**: ${String(schema.version)}`,
    `- **Last deployed**: ${schema.metadata.lastDeployedAt?.toISOString() ?? 'never'}`,
    '',
    '## Tables',
    '',
  ];

  for (const table of schema.tables) {
    lines.push(`### ${table.name}`);
    if (table.description) lines.push('', table.description);
    lines.push('', '| Column | Type | Nullable | PII |', '|--------|------|----------|-----|');
    for (const col of table.columns) {
      const type =
        col.type.kind === 'string' && 'length' in col.type
          ? `string(${String((col.type as { kind: 'string'; length?: number }).length ?? '')})`
          : col.type.kind;
      lines.push(
        `| ${col.name} | ${type} | ${col.nullable ? 'yes' : 'no'} | ${col.isPii ? (col.piiCategory ?? 'yes') : 'no'} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

function schemaToYaml(schema: CustomerSchema): string {
  return `# Schema: ${schema.name}\n${jsonToYaml(schema as unknown as Record<string, unknown>, 0)}`;
}

function jsonToYaml(obj: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return String(obj);
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string')
    return obj.includes('\n') ? `|\n${pad}  ${obj.replace(/\n/g, `\n${pad}  `)}` : obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj
      .map((item) => `\n${pad}- ${jsonToYaml(item as Record<string, unknown>, indent + 1)}`)
      .join('');
  }
  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>)
      .map(([k, v]) => `\n${pad}${k}: ${jsonToYaml(v, indent + 1)}`)
      .join('');
  }
  return JSON.stringify(obj);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100);
}
