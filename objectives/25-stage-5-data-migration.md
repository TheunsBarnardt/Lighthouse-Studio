# Objective 25: Stage 5 — Data Migration

**Status:** Ready for development
**Prerequisites:** Objectives 11 (Schema Designer), 20 (AI Pipeline Foundation), 22 (Stage 2: PRD), 24 (Stage 4: Schema Synthesis) complete
**Blocks:** Stage 6 (UI Generation) — UI generation can proceed in parallel for greenfield projects but waits on migration for projects with existing data; Stage 9 (Deployment) — production deployment of a project with migrations needs them ready

---

## 1. Purpose

For projects starting with existing data — a rebuild of a legacy system, an import from a CSV export, a migration from a competing platform — the **Data Migration stage** helps map the old data structure to the new schema and produces executable migration scripts. The user supplies the source (a database connection, a CSV, a JSON dump, or sample data); the AI proposes a mapping; the user reviews; the platform executes the migration with safety rails.

This stage is **optional**. Greenfield projects skip it entirely. Projects with existing data engage it after Stage 4 (Schema Synthesis) so that the target schema exists before the migration mapping is generated.

A good data migration:

- **Preserves all the data the user wants preserved**, with explicit handling for what gets dropped, transformed, or split
- **Maps types correctly** between source and target (e.g., source `varchar` → target `text`; source `tinyint(1)` → target `boolean`)
- **Handles relationships** — preserving FKs, splitting denormalized columns into normalized tables, joining related tables into embedded documents (for Mongo)
- **Cleans where appropriate** — trims whitespace, normalizes case in lookup values, fixes obvious data issues
- **Validates after migration** — row counts match expected; FK integrity holds; no truncations
- **Is reversible** — at least up to a point; the user can roll back if validation fails

This stage handles the cases that make AI-generated systems actually viable in real organizations. Without it, "the AI built me a CRM" stops at "great, now type all your customer data in by hand" — a non-starter for any business with existing operations.

---

## 2. Scope

### In Scope

- **Source ingestion**: connect to a source database, upload CSV/JSON dumps, or provide sample data
- **Source schema introspection**: read the source's structure (tables, columns, types, FKs)
- **Mapping proposal**: AI maps source columns to target columns; flags where it can't infer; suggests transformations
- **Mapping editor UI**: user reviews and edits the mapping; sees source→target column-by-column
- **Transformation library**: built-in transformations (trim, lowercase, parse dates, normalize phone numbers, parse JSON, split on delimiter, join columns, etc.)
- **Custom transformations**: user can write small JavaScript expressions for custom logic (sandboxed)
- **Sample preview**: show the user the first N rows of the proposed migration result before running
- **Migration execution**: chunked, batched, with progress reporting and resumability
- **Validation post-migration**: row counts, FK integrity, no-data-truncation checks, sample comparisons
- **Rollback capability**: snapshot before migration; rollback if validation fails (or on user request, within a window)
- **Migration scripts as artifacts**: the migration plan is an artifact; reviewable, approvable, re-runnable
- **Multiple source support**: source can be Postgres, MSSQL, MySQL, MongoDB, CSV files, JSON files, Excel files
- **Error reporting**: per-row errors, per-batch errors, with downloadable error reports
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Continuous data sync (deferred — this is a one-shot migration; ongoing replication is a separate product feature)
- Reverse-direction migration (target → source) — out of scope; one-way migrations only
- ETL pipelines beyond what's needed for this one-shot migration (deferred — would require its own product feature)
- Real-time CDC from source (deferred)
- Schema diff and auto-evolution from source schema (the user starts with a target schema; this stage maps to it)
- Data quality scoring beyond basic validation (deferred)
- PII anonymization during migration (deferred — but PII flagging is preserved through the migration)
- Custom transformation packages / UDFs (deferred; built-in library + simple JS expressions are sufficient for v1)

---

## 3. Locked Decisions

| Decision                 | Choice                                                                                             | Rationale                            |
| ------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Source types supported   | Postgres, MSSQL, MySQL, MongoDB, CSV, JSON, Excel (.xlsx)                                          | Cover most common enterprise sources |
| Source connection        | Read-only credentials only; the platform never writes to source                                    | Defensive                            |
| Source data extraction   | Streamed in chunks; never fully loaded into memory                                                 | Handles large datasets               |
| Mapping artifact         | Stored as `migration_plan` artifact; versioned per Objective 20                                    | Reviewable, reusable                 |
| Transformation library   | Curated set of common transformations; no arbitrary code execution beyond sandboxed JS expressions | Safety + utility                     |
| JS expression sandbox    | Web Workers / vm2-style sandbox; no I/O, no globals, time-bounded                                  | Defensive                            |
| Sample preview row count | First 100 rows by default; user-configurable up to 1000                                            | Manageable preview                   |
| Execution batch size     | 1000 rows per batch (configurable per workspace)                                                   | Bounded memory; progress visibility  |
| Pre-migration snapshot   | Mandatory; uses database-native backup mechanisms where available                                  | Rollback safety                      |
| Rollback window          | 24 hours after migration; longer requires explicit retention                                       | Bounded resource cost                |
| Error tolerance modes    | Fail-on-first-error, fail-on-batch-error, continue-with-error-log                                  | User chooses                         |
| Validation checks        | Row count match, FK integrity, no truncation, no NULL violations on required columns               | Standard set                         |
| Audit detail             | Migration plan + execution + per-batch results + per-error rows                                    | Full forensic trail                  |
| Cost target              | $0.50–$5.00 per migration plan generation (cost varies with source size and complexity)            | Cost-aware                           |
| Approval routing         | Per workspace's `data_migration` stage configuration; typically architect or workspace owner       | Sensitive operation                  |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                  USER PROVIDES SOURCE                                  │
│                                                                       │
│   - Source database connection (read-only)                            │
│   - OR: uploaded CSV/JSON/Excel files                                 │
│   - OR: sample data via UI                                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  DATA MIGRATION SERVICE                                │
│                                                                       │
│   1. Source introspection — read source schema, sample rows           │
│   2. Mapping generation (AI) — propose source → target mapping        │
│   3. Mapping review (user) — edit, accept, modify in UI               │
│   4. Sample preview — execute first 100 rows; show result             │
│   5. Approval — submit for approval per workspace config              │
│   6. Snapshot — pre-migration backup of target tables                 │
│   7. Execution — chunked migration with progress + error reporting    │
│   8. Validation — row counts, FK integrity, no truncation             │
│   9. Rollback (if validation fails or user requests)                  │
│  10. Completion — migration record finalized; sources removable       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                ┌────────────────────────┐
                │  Target schema in       │
                │  customer's database    │
                │  populated with         │
                │  migrated data          │
                └────────────────────────┘
```

---

## 5. The Hard Parts

**5.1 Source format diversity**

The user can provide data in many forms:

**Database connections**:

- Postgres, MSSQL, MySQL via JDBC-style connection strings; read-only credentials
- MongoDB via connection string with read-only role
- The platform connects, introspects, samples, and reads in chunks; never writes

**File uploads**:

- CSV (RFC 4180; the platform handles common variations — different delimiters, quoting styles, encodings)
- JSON (array of objects; or JSON Lines)
- Excel (.xlsx) via streaming reader

**Sample data via UI**:

- Power-user paste of CSV/JSON directly into a textarea (for small migrations or testing)

Each source type has its own ingest adapter. The downstream pipeline (mapping, transformation, execution) is source-agnostic.

For large source databases, the platform doesn't try to copy everything to itself first — it streams source data through the migration pipeline directly to the target. For files, they upload to platform storage and stream from there.

**5.2 Source introspection**

For source databases, the platform reads the source's structure:

- Tables, columns, types
- Primary keys, foreign keys
- Indexes (informational; not migrated)
- Row counts (for migration size estimation)
- Sample rows (10-100 per table) for the AI to see actual data shape

For files, the platform reads:

- Header row to identify column names (CSV/Excel)
- Sample rows to infer types
- Total row count

The introspection produces a normalized "source description" that the mapping prompt uses.

**5.3 Mapping generation**

The AI receives:

- Source description (tables, columns, sample data)
- Target schema (from Stage 4)
- PRD context (informs what the data is for)
- Optional user notes ("the `cust_id` field in source becomes `customer_id` in target")

It produces a mapping:

- Per source table → target table (or multiple targets, or split into multiple)
- Per source column → target column (or transformation, or drop)
- Transformation chain per column where types/formats differ
- FK preservation strategy
- Notes on ambiguities or required user decisions

For complex source structures (denormalized tables, polymorphic columns, EAV patterns), the mapping is non-trivial. The AI flags ambiguities for user review rather than guessing.

**5.4 The mapping editor UI**

The mapping is the user's primary interface. The UI shows:

- **Source side**: tree of source tables and columns with sample values
- **Target side**: tree of target tables and columns
- **Connections**: lines between source and target columns showing the mapping
- **Transformations**: badges on connection lines indicating any transformations applied
- **Issues**: warnings/errors for unmapped required target columns, type mismatches, ambiguous mappings
- **Per-column detail panel**: when a connection is selected, shows transformation pipeline, sample input → output, edit options

Editing actions:

- Add a connection between source and target columns
- Remove a connection
- Add transformations to a connection
- Map a column to a literal value
- Mark a target column as "intentionally unmapped" (uses default or NULL)
- Split a source column to multiple target columns (e.g., `full_name` → `first_name` + `last_name` via splitting)
- Combine multiple source columns into one target (e.g., `addr_line_1` + `addr_line_2` → `address`)

The UI is deliberately not a "code editor for migrations" — it's visual and direct. Power users who want code can work with the underlying migration plan artifact (which is YAML).

**5.5 Transformation library**

Common transformations as building blocks:

**String**: trim, lowercase, uppercase, capitalize, slugify, regex replace, regex extract, split, join, substring, pad, mask
**Number**: parse_int, parse_float, round, multiply, divide, add, subtract
**Date**: parse_date (with format hints), format_date, add_days, to_unix_timestamp
**Boolean**: parse_bool ("yes"/"no", "1"/"0", "true"/"false")
**JSON**: parse_json, format_json, extract_path
**Lookup**: lookup_in_table (with a small in-memory cache for FK resolution)
**Conditional**: if_null, if_empty, default_if
**FK resolution**: resolve_by_natural_key (look up the target row by a natural key like email; use its UUID)

Transformations chain: `trim → lowercase → parse_email`. Each step receives the previous step's output.

**5.6 Custom transformations as JS expressions**

For cases the library doesn't cover, the user can write JavaScript expressions:

```javascript
// Input: row (the source row), value (the current column value)
// Output: any value
return value.replace(/\s+/g, ' ').trim();
```

The expression runs in a sandbox:

- Web Worker isolation (browser side for preview)
- vm2-style sandbox for production execution
- No I/O (no fetch, no fs, no eval)
- No globals beyond a small set (Math, Date, JSON, console for warnings)
- Time-bounded (100ms per row default)

The sandbox is the security frontier. Bugs here let users break out and access the platform's runtime. The implementation uses well-tested isolation libraries; the sandbox itself is audited as part of Objective 10's security review.

**5.7 Sample preview**

Before committing to migration, the user previews:

- The first 100 rows of the source (configurable up to 1000)
- Pass through the full mapping pipeline
- Show the resulting target rows
- Highlight any errors or warnings

The preview is visual: source row → transformations → target row, with each transformation step visible.

If the preview shows problems (truncated data, type mismatches, transformation errors), the user adjusts the mapping and previews again.

The sample preview is **read-only** on the target — it doesn't actually write rows. It's a dry run.

**5.8 Pre-migration snapshot**

Before executing the migration, the platform takes a snapshot of the target tables:

- For Postgres: pg_dump of affected schemas
- For MSSQL: native backup of affected tables
- For Mongo: mongodump of affected collections

The snapshot is stored in the platform's storage (Objective 15). Retention 24 hours by default; user can extend.

For greenfield migrations (target tables empty), the snapshot is trivial. For migrations replacing existing data, the snapshot is essential — it's the rollback path if things go wrong.

**5.9 Execution**

Migration runs as a background job:

- Reads source data in chunks (1000 rows per chunk default)
- Applies the mapping pipeline per row
- Writes to target via the platform's bulk-create API (Objective 12)
- Reports progress per chunk
- On error: per the chosen tolerance mode

Tolerance modes:

- **Fail-on-first-error**: stops at the first failed row; rolls back the chunk
- **Fail-on-batch-error**: continues if individual rows fail but stops if a chunk has > X% failures
- **Continue-with-error-log**: continues regardless; failed rows logged to a downloadable error report

The default is fail-on-batch-error with 5% threshold — protects against systematic problems while tolerating occasional bad rows.

Progress is visible in real-time: "Migrated 47,000 of 100,000 rows. ETA: 4 minutes. Errors: 23." The user can pause, cancel, or adjust mid-flight (though mid-flight changes invalidate the migration; usually one cancels and starts over).

**5.10 Validation**

After execution, validation runs:

- **Row count**: target table row count = expected (source rows that should have made it through, given any drops in the mapping)
- **FK integrity**: every FK column references an existing target row
- **No truncation**: no varchar columns at exactly their max length (likely truncated)
- **Required columns**: no NULL in NOT NULL columns
- **Sample comparison**: spot-check 100 random source rows; verify they appear correctly in target

Validation produces a report. Pass: migration is committed. Fail: user is alerted with the specific failures; can choose to roll back or accept and address manually.

**5.11 Rollback**

If validation fails or the user requests rollback within the retention window:

- Target tables restored from snapshot
- Migration record marked rolled back
- Audit trail preserved
- Source data and mapping artifact remain (for re-attempt)

After 24 hours (or the configured retention), the snapshot is archived; rollback requires a more involved recovery procedure (documented in runbook).

**5.12 Reversible vs. irreversible operations**

Some migration operations are inherently irreversible:

- Splitting a column into two and dropping the original (the original can't be reconstructed if the split was lossy)
- Aggregating multiple rows into one
- Hashing or anonymizing PII

The platform flags these clearly in the mapping editor: "This operation cannot be reversed by rollback after the snapshot retention window expires." The user explicitly acknowledges before approving.

**5.13 Quality signals**

Beyond Objective 20's generic signals:

- **Mapping accuracy**: of the AI's proposed mappings, what % did the user accept vs. modify vs. reject?
- **Validation pass rate**: did the migration's validation pass without overrides?
- **Rollback rate**: how often did migrations get rolled back?
- **Per-source-type success**: which sources (Postgres, CSV, etc.) have the highest success rates?
- **Per-transformation usage**: which transformations are used most? (informs library expansion)
- **Time to completion**: from source connection to validated migration

These signals inform prompt iteration and library expansion.

---

## 6. Component Specifications

### 6.1 DataMigrationService

```typescript
// packages/core/src/services/ai/data-migration/data-migration.service.ts

export class DataMigrationService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly schemas: SchemaService,
    private readonly storage: StorageService,
    private readonly jobs: JobQueuePort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {}

  /** Connect to a source database. */
  async connectSource(ctx: RequestContext, input: ConnectSourceInput): Promise<Result<SourceConnection, AppError>>;

  /** Upload a source file. */
  async uploadSourceFile(ctx: RequestContext, input: UploadSourceFileInput): Promise<Result<SourceConnection, AppError>>;

  /** Introspect a connected source. */
  async introspectSource(ctx: RequestContext, sourceConnectionId: string): Promise<Result<SourceDescription, AppError>>;

  /** Generate a migration mapping plan. */
  async generateMappingPlan(ctx: RequestContext, input: GenerateMappingInput): Promise<Result<Artifact<MigrationPlan>, AppError>>;

  /** Update the mapping plan based on user edits. */
  async updateMappingPlan(ctx: RequestContext, planId: string, changes: MappingPlanChanges): Promise<Result<Artifact<MigrationPlan>, AppError>>;

  /** Preview the migration with sample data. */
  async previewMigration(ctx: RequestContext, planId: string, sampleSize?: number): Promise<Result<MigrationPreview, AppError>>;

  /** Submit migration plan for approval. */
  async submitForApproval(ctx: RequestContext, planId: string): Promise<Result<Artifact<MigrationPlan>, AppError>>;

  /** Execute the approved migration. */
  async executeMigration(ctx: RequestContext, planId: string, options: ExecuteOptions): Promise<Result<MigrationExecution, AppError>>;

  /** Get execution status. */
  async getExecutionStatus(ctx: RequestContext, executionId: string): Promise<Result<MigrationExecution, AppError>>;

  /** Cancel a running migration. */
  async cancelExecution(ctx: RequestContext, executionId: string): Promise<Result<void, AppError>>;

  /** Validate a completed migration. */
  async validateMigration(ctx: RequestContext, executionId: string): Promise<Result<ValidationReport, AppError>>;

  /** Roll back a migration. */
  async rollbackMigration(ctx: RequestContext, executionId: string): Promise<Result<RollbackResult, AppError>>;
}
```

### 6.2 The Migration Plan Artifact

```typescript
interface MigrationPlan {
  prdArtifactId: string; // parent
  schemaArtifactId: string; // target schema
  sourceConnectionId: string;
  sourceDescription: SourceDescription;

  tableMappings: TableMapping[];

  preExecutionChecks: PreExecutionCheck[];
  postExecutionChecks: PostExecutionCheck[];

  toleranceMode: 'fail_on_first_error' | 'fail_on_batch_error' | 'continue_with_error_log';
  batchSize: number;
  irreversibleOperations: IrreversibleOperation[];
}

interface TableMapping {
  sourceTableId: string;
  targetTableId: string;
  rowFilter?: FilterExpression; // skip source rows matching this
  columnMappings: ColumnMapping[];
  splitInto?: TableSplitDef[]; // if one source maps to multiple targets
}

interface ColumnMapping {
  sourceColumnId: string | null; // null = literal value or computed
  targetColumnId: string;
  literalValue?: unknown;
  transformations: TransformationStep[];
  validationRules?: ValidationRule[];
}

interface TransformationStep {
  type: string; // 'trim', 'lowercase', 'parse_date', 'js_expression', etc.
  parameters: Record<string, unknown>;
  customExpression?: string; // for js_expression type
}

interface PreExecutionCheck {
  type: 'snapshot_target' | 'validate_source_accessible' | 'estimate_size';
  status: 'pending' | 'passed' | 'failed';
  details?: Record<string, unknown>;
}

interface PostExecutionCheck {
  type: 'row_count_match' | 'fk_integrity' | 'no_truncation' | 'required_columns_populated' | 'sample_comparison';
  expectedValue?: unknown;
  actualValue?: unknown;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
}

interface IrreversibleOperation {
  description: string;
  affectedTables: string[];
  reasoning: string;
  acknowledged: boolean;
  acknowledgedByUserId?: string;
  acknowledgedAt?: Date;
}
```

### 6.3 The Source Description Model

```typescript
interface SourceDescription {
  type: 'postgres' | 'mssql' | 'mysql' | 'mongo' | 'csv' | 'json' | 'excel';
  identifier: string; // connection string redacted; or filename

  tables: SourceTable[]; // for relational sources; one entry per CSV file; one per JSON array; etc.
  totalRowCount: number;
  totalSizeBytes?: number;

  introspectedAt: Date;
}

interface SourceTable {
  id: string;
  name: string;
  columns: SourceColumn[];
  rowCount: number;
  sampleRows: Record<string, unknown>[]; // 10-100 sample rows for the AI
  primaryKey?: string[];
  foreignKeys?: SourceForeignKey[];
}

interface SourceColumn {
  id: string;
  name: string;
  type: string; // source-native type
  inferredType?: string; // for files where type is inferred from data
  nullable: boolean;
  hasDefault: boolean;
  uniqueValues?: number; // for low-cardinality columns
  sampleValues: unknown[];
}
```

### 6.4 The Generation Prompts

In `packages/core/src/ai/prompts/data-migration/`:

- `mapping-generation.prompt.ts` — generate the table+column mapping
- `transformation-suggestion.prompt.ts` — suggest transformations for type/format mismatches
- `fk-resolution-strategy.prompt.ts` — handle FK preservation
- `denormalization-detection.prompt.ts` — detect when source columns should split into multiple target columns or rows
- `validation-rules.prompt.ts` — generate per-column validation rules
- `regeneration.prompt.ts` — regenerate mapping with feedback
- `orchestrator.prompt.ts` — top-level

Each follows Objective 20's `definePrompt` API with test suites against canonical migration scenarios.

### 6.5 The Source Adapters

```typescript
// packages/adapters/migration-source/src/

export interface SourceAdapterPort {
  connect(config: SourceConfig): Promise<Result<SourceConnection, AppError>>;
  introspect(connection: SourceConnection): Promise<Result<SourceDescription, AppError>>;
  streamRows(connection: SourceConnection, tableId: string, batchSize: number): AsyncIterable<SourceRow>;
  disconnect(connection: SourceConnection): Promise<void>;
}

class PostgresSourceAdapter implements SourceAdapterPort {
  /* ... */
}
class MssqlSourceAdapter implements SourceAdapterPort {
  /* ... */
}
class MysqlSourceAdapter implements SourceAdapterPort {
  /* ... */
}
class MongoSourceAdapter implements SourceAdapterPort {
  /* ... */
}
class CsvFileSourceAdapter implements SourceAdapterPort {
  /* ... */
}
class JsonFileSourceAdapter implements SourceAdapterPort {
  /* ... */
}
class ExcelFileSourceAdapter implements SourceAdapterPort {
  /* ... */
}
```

Each adapter handles its source's specifics. The downstream pipeline (transformation, target write) is source-agnostic.

### 6.6 The Transformation Engine

```typescript
// packages/core/src/services/ai/data-migration/transformation-engine.ts

export class TransformationEngine {
  /** Apply a transformation chain to a value. */
  apply(value: unknown, steps: TransformationStep[], context: TransformationContext): TransformationResult;

  /** Execute a sandboxed JS expression. */
  executeSandboxed(expression: string, value: unknown, row: Record<string, unknown>): Promise<unknown>;

  /** Get the registered library of built-in transformations. */
  getLibrary(): TransformationLibraryEntry[];
}

interface TransformationContext {
  sourceRow: Record<string, unknown>;
  sourceColumn: SourceColumn;
  targetColumn: ColumnDefinition;
  targetSchema: CustomerSchema;
  lookupCache: LookupCache; // for resolve_by_natural_key transformations
}
```

The engine is pure (no I/O) for built-in transformations. The sandboxed JS path uses a Worker (browser) or vm2 (server).

### 6.7 The Migration Execution Worker

A background job that processes the migration:

```typescript
// packages/core/src/services/ai/data-migration/migration-executor.ts

export class MigrationExecutor {
  async execute(executionId: string): Promise<void> {
    // 1. Load the plan
    // 2. Take pre-migration snapshot
    // 3. For each table mapping:
    //    a. Stream source rows in batches
    //    b. Apply transformations per row
    //    c. Validate per row (NULL checks, type checks)
    //    d. Buffer in batch
    //    e. Bulk-insert into target via platform's bulk API
    //    f. Update progress
    //    g. On error: per tolerance mode
    // 4. Run post-execution validation
    // 5. Mark complete
  }
}
```

The executor is resumable: progress is checkpointed; on crash, it resumes from the last completed batch.

### 6.8 The Migration UI

Lives in `apps/web/src/ai-pipeline/data-migration/`:

- `DataMigrationPage.tsx` — main page; multi-step flow
- `steps/SourceStep.tsx` — pick source type, connect/upload
- `steps/IntrospectionStep.tsx` — show what was found
- `steps/MappingStep.tsx` — the mapping editor
- `steps/PreviewStep.tsx` — sample preview
- `steps/ApprovalStep.tsx` — submit for approval
- `steps/ExecutionStep.tsx` — progress + cancel
- `steps/ValidationStep.tsx` — validation report; rollback option
- `components/MappingCanvas.tsx` — the visual mapping editor
- `components/TableConnection.tsx` — source-table → target-table line
- `components/ColumnConnection.tsx` — source-column → target-column line with transformations
- `components/TransformationBuilder.tsx` — chain transformations
- `components/JsExpressionEditor.tsx` — sandboxed JS editor
- `components/ProgressIndicator.tsx`
- `dialogs/IrreversibleOperationDialog.tsx`
- `dialogs/RollbackConfirmationDialog.tsx`

The mapping canvas is the heart of the UX. It's visual; it's direct; it's the difference between "this AI thing is magic" and "I had to write SQL anyway."

### 6.9 Audit Events

```
ai.data_migration.source_connected
ai.data_migration.source_introspected
ai.data_migration.mapping_generated
ai.data_migration.mapping_edited
ai.data_migration.preview_run
ai.data_migration.submitted_for_approval
ai.data_migration.approved
ai.data_migration.snapshot_taken
ai.data_migration.execution_started
ai.data_migration.execution_progress (sampled, every N batches)
ai.data_migration.batch_failed
ai.data_migration.execution_completed
ai.data_migration.execution_failed
ai.data_migration.execution_cancelled
ai.data_migration.validation_run
ai.data_migration.rollback_initiated
ai.data_migration.rollback_completed
```

### 6.10 Permissions

```
ai.data_migration.create     — create migration plans
ai.data_migration.read        — view migration plans and execution history
ai.data_migration.execute     — execute approved migrations
ai.data_migration.approve     — approve plans
ai.data_migration.rollback    — initiate rollback
```

Default role mappings:

- `workspace_owner`, `workspace_admin`: all
- `architect`: all
- `developer`: create, read, execute (for dev environments)
- `qa`, `reviewer`, `viewer`: read
- Custom roles configurable

For production environments, `execute` and `rollback` typically restricted to architect/owner.

### 6.11 Quality Signals Specifics

```typescript
interface DataMigrationQualitySignals {
  planArtifactId: string;
  sourceType: string;

  // Mapping
  totalSourceColumns: number;
  aiMappingsAccepted: number;
  aiMappingsModified: number;
  aiMappingsRejected: number;
  manualMappingsAdded: number;

  // Transformations
  totalTransformationsUsed: number;
  customJsExpressionsUsed: number;

  // Execution
  totalSourceRows: number;
  successfulMigratedRows: number;
  failedRows: number;
  executionDurationSeconds: number;

  // Validation
  validationChecksRun: number;
  validationChecksPassed: number;
  validationCheckFailures: ValidationFailure[];

  // Outcome
  outcome: 'completed' | 'rolled_back' | 'cancelled' | 'failed';
  rollbackReason?: string;
}
```

### 6.12 Operational Runbooks

- `data-migration-stuck.md` — when execution is hung; how to safely cancel
- `data-migration-rollback-after-window.md` — manual recovery when snapshot retention expired
- `data-migration-source-credentials-rotation.md` — handling expired source credentials mid-flight
- `data-migration-large-source-strategy.md` — handling sources too large for typical batch sizes
- `data-migration-orphaned-fk-cleanup.md` — when FK resolution leaves orphans
- `data-migration-character-encoding-issues.md` — common file encoding problems

---

## 7. Implementation Order

1. **Migration plan schema** locked in TypeScript types and zod.

2. **Source description schema** locked.

3. **Source adapter port** defined; conformance tests.

4. **Source adapters per type**: Postgres, MSSQL, MySQL, Mongo, CSV, JSON, Excel.

5. **Source introspection** producing canonical SourceDescription.

6. **Transformation library** with the curated built-in transformations.

7. **Sandboxed JS expression engine** (Web Worker browser-side; vm2 server-side).

8. **Mapping generation prompts** authored as `definePrompt` modules with test suites.

9. **DataMigrationService skeleton.**

10. **Mapping plan generation end-to-end.**

11. **Mapping editor UI** with visual canvas.

12. **Sample preview** running through the pipeline without writing.

13. **Pre-migration snapshot** mechanism.

14. **Migration executor worker** with chunked processing, error tolerance modes, progress tracking.

15. **Post-migration validation** checks.

16. **Rollback mechanism** restoring from snapshot.

17. **Stage pipeline integration** (submit, approve).

18. **Quality signal recording.**

19. **Audit events emitted.**

20. **Conformance tests** across source types and target databases.

21. **End-to-end test**: connect source → generate mapping → preview → approve → execute → validate.

22. **Documentation, ADRs, runbooks.**

23. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0184: One-Shot Migration, Not Continuous Sync** — scope; ongoing replication is a future product
- **ADR-0185: Source Adapters per Type, Common Pipeline** — separation of concerns
- **ADR-0186: Mandatory Pre-Migration Snapshot** — safety; bounded retention window
- **ADR-0187: Three Tolerance Modes for Errors** — flexibility for different scenarios
- **ADR-0188: Sandboxed JS Expressions for Custom Logic** — power vs. safety trade-off
- **ADR-0189: Visual Mapping Canvas, Not Code Editor** — accessibility for non-engineers
- **ADR-0190: Validation Failures Surface; User Decides Rollback** — humans decide on edge cases

---

## 9. Verification Steps

1. **Connect to a source Postgres database** with read-only credentials; introspection succeeds.

2. **Connect to a MySQL source**; introspection succeeds.

3. **Upload a CSV file**; introspection identifies columns and sample rows.

4. **Upload an Excel file with multiple sheets**; each sheet introspected as a separate source table.

5. **Generate mapping** from a small Postgres source to a Postgres target; mapping covers all source columns.

6. **Mapping editor**: visually edit a column mapping; add transformation; save.

7. **Sample preview**: first 100 rows shown with transformations applied; truncation/error indicators visible.

8. **Sandboxed JS expression**: a custom expression runs and returns expected output; an expression with `eval()` is rejected at edit time.

9. **Pre-migration snapshot taken** before execution; visible in storage.

10. **Migration execution** with 10,000-row source completes; progress reported in real-time.

11. **Migration with 1M rows** completes; chunked execution works; resumable on simulated crash.

12. **Tolerance mode: fail-on-batch-error** stops execution when 5%+ of a batch fails.

13. **Tolerance mode: continue-with-error-log** completes despite errors; downloadable error report.

14. **Validation post-migration**: row count match, FK integrity, no truncation all pass.

15. **Validation failure**: simulated FK integrity failure detected; user shown the failure; option to roll back.

16. **Rollback** within retention window restores target tables to snapshot.

17. **Cancel mid-execution**: clean cancellation; partial data left in known state; rollback option remains.

18. **CSV with non-UTF-8 encoding**: detected; user prompted to specify encoding.

19. **Source with denormalized data**: AI proposes splitting into target tables.

20. **FK resolution**: source has natural-key FKs (e.g., email-based); target uses UUID; resolution works via lookup transformation.

21. **Mongo to Postgres migration**: document arrays mapped to junction tables.

22. **Postgres to Mongo migration**: related tables embedded as documents where appropriate.

23. **Stage pipeline integration**: plan → submit → approve → execute.

24. **Audit trail**: full migration history visible per workspace.

25. **Quality signals**: AI mapping acceptance rate, validation pass rate recorded.

26. **Cost tracking**: migration plan generation cost recorded; execution runtime tracked.

If all 26 pass, the objective is met.

---

## 10. Definition of Done

**Schema & Types**

- [ ] MigrationPlan artifact schema
- [ ] SourceDescription schema
- [ ] All sub-structures

**Source Adapters**

- [ ] Postgres
- [ ] MSSQL
- [ ] MySQL
- [ ] Mongo
- [ ] CSV
- [ ] JSON
- [ ] Excel
- [ ] Conformance tests pass

**Transformation Engine**

- [ ] Built-in transformation library
- [ ] Sandboxed JS expression executor
- [ ] Pure-function built-ins
- [ ] Worker-based browser sandbox
- [ ] vm2-based server sandbox

**Prompts**

- [ ] All prompts authored
- [ ] Test suites against canonical scenarios
- [ ] CI runs prompt tests

**Service Layer**

- [ ] DataMigrationService implemented
- [ ] All connection, introspection, mapping, preview, execute, validate, rollback methods

**Execution Worker**

- [ ] Chunked processing
- [ ] Resumable on crash
- [ ] Progress tracking
- [ ] Three tolerance modes
- [ ] Error reporting

**Snapshot & Rollback**

- [ ] Pre-migration snapshot per database type
- [ ] 24-hour retention default
- [ ] Rollback restores within window

**UI**

- [ ] Multi-step page
- [ ] Source connection / upload UI
- [ ] Introspection results display
- [ ] Mapping canvas with visual connections
- [ ] Transformation builder
- [ ] JS expression editor with sandbox preview
- [ ] Sample preview
- [ ] Execution progress
- [ ] Validation report
- [ ] All dialogs (irreversible, rollback)

**Quality & Observability**

- [ ] Quality signals recorded
- [ ] Per-prompt dashboards
- [ ] Per-source-type metrics
- [ ] Stage-specific metrics

**Permissions**

- [ ] Stage permissions added
- [ ] Default role grants

**Cross-Database**

- [ ] Migrations work between any source and any target driver
- [ ] Capability-aware mapping

**Documentation**

- [ ] ADRs 0184–0190 written and Accepted
- [ ] All runbooks in Section 6.12 written
- [ ] Customer-facing data migration guide
- [ ] Transformation library reference

**Verification**

- [ ] All 26 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Writing to source databases.** Read-only credentials only; the platform never writes to sources.
- **Loading entire source datasets into memory.** Streamed in chunks; bounded memory always.
- **Executing without a snapshot.** Mandatory; bounded retention.
- **Allowing arbitrary code execution beyond the sandbox.** JS expressions go through the sandbox; no escape hatches.
- **Silent rollback after validation failure.** User decides; the platform reports.
- **Mapping plans that aren't reviewable.** Visual editor first; YAML accessible for power users; never code-only.
- **Skipping post-migration validation.** Validation is mandatory; failures surface clearly.
- **Treating one-shot migration like continuous replication.** This is one-shot; ongoing sync is a separate product.
- **Hardcoding source-specific logic in the pipeline.** Source adapters; downstream pipeline source-agnostic.
- **Leaking source credentials.** Stored via SecretStorePort; redacted in logs and audit records.
- **Allowing migrations to bypass the target's bulk-create API permissions.** Same auth as direct API writes.

---

## 12. Open Questions for Confirmation Before Starting

1. **Source types in v1** — proposing 7 (Postgres, MSSQL, MySQL, Mongo, CSV, JSON, Excel). Worth more (Oracle, SQLite, Parquet)? Recommendation: ship with 7; add others as customer demand reveals gaps.

2. **JS sandbox depth** — proposing Web Worker browser-side, vm2 server-side. Some teams might want WebAssembly-based isolation for stronger guarantees. Recommendation: start with worker/vm2; revisit if security review requires.

3. **Default tolerance mode** — proposing fail-on-batch-error with 5% threshold. Acceptable? Some prefer fail-on-first; some prefer continue. Recommendation: fail-on-batch as middle-ground default; user picks per migration.

4. **Snapshot retention default** — proposing 24 hours. Some teams want longer for safety. Recommendation: 24h default; configurable up to 7 days.

5. **Skipping data migration entirely** — for greenfield projects, this stage is skipped. UI should make skipping obvious. Confirmed?

6. **Mapping artifact retention** — should completed migration plans be retained indefinitely (forensic value) or archived after N days? Recommendation: retained per audit log retention (default 7 years); execution data archived after 90 days unless flagged.

7. **Validation rules customization** — user can add custom validation rules beyond the built-ins? Recommendation: defer custom validations to a follow-up; built-in set is sufficient for v1.

---

## 13. What Comes Next

With Objective 25 complete, projects with existing data can be migrated to the AI-generated schema. Greenfield projects skip this stage entirely. Either way, the target schema is now populated and ready for the rest of the pipeline.

**Objective 26: Stage 6 — UI Generation** is next. The schema (Stage 4), the design tokens (Stage 3), and the PRD (Stage 2) combine to generate React components — page layouts, forms, tables, navigation, modals. The first stage producing "the actual product" rather than artifacts about the product.

The remaining stages chain forward:

- **27: Code Generation** — server-side logic, integrations
- **28: Test Generation** — from acceptance criteria
- **29: Deployment** — through environments
- **30: Maintenance** — feedback loops, regeneration

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 26._
