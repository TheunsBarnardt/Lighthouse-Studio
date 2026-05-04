# Objective 11: Data Management Module — Foundation & Schema Designer

**Status:** Backend complete (2026-05-03); user-facing UI carved out to **Objective 11.5 — Schema Designer UI**
**Prerequisites:** All foundation objectives (1 through 10) complete
**Blocks:** Every other Data Management Module objective (12 through 19)

> **2026-05-03 scope split.** The original Obj 11 bundled the schema-designer service layer with the schema-designer UI. Verification on 2026-05-03 confirmed the backend complete and exhaustively tested while the web app at `apps/web/src/` was effectively empty. Rather than block Stage One progress on a UI that has no dependants until Obj 18, the UI is split into [Objective 11.5](11.5-schema-designer-ui.md). This objective is closed against the backend Definition of Done; every UI-related checkbox in Section 10 below is satisfied through 11.5 instead. Backend evidence for closure: `packages/core/src/services/data-management/` (`schema.service.ts`, `schema-validator.ts`, `migration-planner.ts`, `schema-model.ts`, `audit-events.ts`, `templates/`), `packages/core/tests/leak-tests/cross-tenant-isolation.test.ts`, and ADRs 0094–0098 all Accepted.

---

## 1. Purpose

Establish the Data Management Module as a first-class feature within the platform, and implement the visual schema designer that is the foundation of every later capability in the module.

The Data Management Module is the **Supabase-equivalent layer for any supported database** — Postgres, MSSQL, MongoDB. A customer can install the platform, point it at their existing database (or a new one), and immediately get a Supabase-quality experience: visual schema design, auto-generated APIs, real-time subscriptions, storage, authentication, a query console, a data browser. All without coupling to Postgres-specific features that don't translate to MSSQL or Mongo.

The schema designer is the foundation. Before APIs can be auto-generated, the platform must understand the schema. Before real-time can stream changes, the platform must know which tables exist. Before the data browser can display rows, the platform must know what columns are present. The schema designer is the source of truth that everything else reads from.

This objective produces the **first user-facing feature of the platform**. Until now, every objective produced infrastructure or developer-only tools. This objective produces a UI a customer can use, a feature a customer can buy, a screen a salesperson can demo.

---

## 2. Scope

### In Scope

- The **Data Management Module** as an organizational concept: where it lives in the codebase, what it includes, how it relates to the AI pipeline (separately developed)
- The **schema designer UI**: visual, drag-and-drop where appropriate, capability-aware
- **Schema models**: the platform's internal representation of customer-defined tables, columns, relationships, indexes, constraints
- **Schema migrations**: how customer schema changes propagate to their database safely (with rollback)
- **Schema validation**: pre-flight checks before applying changes
- **Capability-aware UX**: the UI surfaces what works on the chosen database; gracefully disables what doesn't
- **Schema versioning**: every schema change tracked; rollback supported
- **Schema templates**: starter templates (e.g., "blog", "CRM", "task tracker") for new customers
- **Initial set of permissions**: who can read schemas, edit, deploy
- **Conformance with the foundation**: every operation goes through service layer pattern, audit, RBAC, etc.
- ADRs

### Out of Scope (Belongs to Later Objectives)

- Auto-generated REST APIs (Objective 12)
- Auto-generated GraphQL APIs (Objective 13)
- Real-time subscriptions (Objective 14)
- Storage browser UI (Objective 15)
- Auth/user management UI (Objective 16)
- Query console (Objective 17)
- Data browser / row editor (Objective 18)
- Public SDK (Objective 19)
- AI-assisted schema generation (covered later as part of the AI pipeline integration)
- Cross-table referential integrity enforcement at the application layer for Mongo (deferred; surfaced as a UI warning instead)

---

## 3. Locked Decisions

| Decision                               | Choice                                                                                                                                                                          | Rationale                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Module namespace                       | `apps/web/src/data-management/` for UI; `packages/core/src/services/data-management/` for services                                                                              | Separates this large feature from the rest                             |
| Schema model location                  | The platform's primary database (the one running the platform itself), separate from customer-defined tables                                                                    | Schema metadata is platform data; customer tables are customer data    |
| Customer-defined table location        | The same physical database as the platform's, but in a separate logical schema (Postgres: `customer` schema; MSSQL: separate schema; Mongo: prefixed collections like `cust_*`) | Isolation between platform internals and customer-defined structures   |
| Schema designer UI framework           | React + the shadcn/ui components established in Objective 1                                                                                                                     | Consistent with the rest of the web app                                |
| Visual editor library                  | `@xyflow/react` for the relationship diagram view                                                                                                                               | Industry standard; well-maintained                                     |
| Form library                           | `react-hook-form` + zod resolvers                                                                                                                                               | Already in the stack                                                   |
| Schema model representation            | A normalized internal model (defined in 1.5), with adapter-specific serialization at write time                                                                                 | The capability matrix from Objective 4c is enforced at the model layer |
| Schema migration mechanism             | Multi-phase: validate → preview → apply, with rollback, leveraging the SchemaDdlPort and SchemaMigrationPort                                                                    | Same migration discipline as the platform's own schema                 |
| Schema versioning                      | Every customer schema change creates a version record; full history queryable                                                                                                   | Auditability, rollback, drift detection                                |
| Schema collaboration                   | Optimistic locking with conflict detection on save                                                                                                                              | Multiple people editing simultaneously is real                         |
| Naming conventions for customer tables | `lowercase_snake_case` enforced; reserved word list per database                                                                                                                | Avoids dialect collisions                                              |
| Reserved prefixes                      | `_platform_*`, `cust_*` prefixes have semantic meaning                                                                                                                          | Internal vs. customer tables clearly separated                         |
| Approval routing                       | Schema changes go through the configurable approval routing from Objective 6                                                                                                    | Solo: instant. Enterprise: architect approves. Same engine.            |
| First-run UX                           | Empty workspace shows starter templates; "Start blank" is also an option                                                                                                        | Reduces friction for first-time users                                  |
| Documentation generation               | Each schema can produce auto-generated docs (markdown export, JSON schema export)                                                                                               | Customers want to share schemas                                        |

---

## 4. Architectural Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        THE PLATFORM                                   │
│                                                                       │
│  ┌──────────────────────────┐       ┌──────────────────────────────┐│
│  │  AI Build Pipeline        │       │  Data Management Module      ││
│  │  (Objectives 20+)         │       │  (Objectives 11–19)           ││
│  │  ─────────────────        │       │  ──────────────────────       ││
│  │  Intent → PRD →           │       │  Schema → APIs → Real-time   ││
│  │  Design Tokens → ...      │       │  Storage → Auth → Console    ││
│  │  Deploy → Monitor         │       │  Data Browser → SDK          ││
│  └────────────┬─────────────┘       └──────────────┬───────────────┘│
│               │                                     │                 │
│               │ shared substrate                    │                 │
│               ▼                                     ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │   FOUNDATION (Objectives 1–10)                                   ││
│  │   - Persistence ports (Postgres, MSSQL, Mongo)                   ││
│  │   - Identity, RBAC, Audit                                        ││
│  │   - Observability, Service Layer, Cross-Platform                 ││
│  └──────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘

The two product surfaces share the foundation. The Data Management Module
can be used standalone (a customer just wants Supabase-for-MSSQL) or as
the data backend for apps the AI Build Pipeline produces.
```

The Data Management Module is the simpler half of the product to ship. It has clear analogues (Supabase, Hasura, Directus). The AI Build Pipeline is the more ambitious half. Both are valid revenue paths; the data management module is likely to ship first because it's better-understood territory.

---

## 5. The Schema Designer

### 5.1 Three Views

The schema designer presents three complementary views of the same data:

1. **Diagram view** — a visual graph of tables and relationships. Drag tables, drag-to-connect for foreign keys, see at a glance how everything fits together. Built on `@xyflow/react`.

2. **Table view** — a list of tables, each expandable to show columns. Faster for editing many tables sequentially; better for keyboard-driven workflows.

3. **Code view** — the schema as a YAML or JSON document. For power users who prefer text editing; for diffing in version control; for bulk imports.

All three views edit the same underlying model. Switching between them is instant. Changes are applied via the same path regardless of which view authored them.

### 5.2 What a Schema Looks Like

The platform's internal schema model (refined from Objective 1.5):

```typescript
// packages/core/src/services/data-management/schema-model.ts

export interface CustomerSchema {
  id: string; // UUID v7
  workspaceId: string;
  name: string; // human-readable
  slug: string; // URL-safe; unique within workspace
  description?: string;
  version: number; // schema version for optimistic locking
  databaseDriver: 'postgres' | 'mssql' | 'mongo';
  tables: TableDefinition[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string;
    lastDeployedAt?: Date;
    deployedVersion?: number;
  };
}

export interface TableDefinition {
  id: string; // stable identifier; survives renames
  name: string; // current name (snake_case enforced)
  description?: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  constraints: ConstraintDefinition[];
  // Capability-driven optional features:
  fullTextSearch?: FullTextSearchConfig;
  changeStream?: { enabled: boolean };
  rowLevelSecurity?: RlsConfig; // null/undefined for adapters without RLS support
  primaryKey: PrimaryKeyDefinition;
}

export interface ColumnDefinition {
  id: string; // stable identifier; survives renames
  name: string;
  type: NormalizedType; // 'string(n)', 'integer', etc. — finite, capability-checked
  nullable: boolean;
  defaultValue?: DefaultValueExpression;
  generated?: GeneratedExpression; // computed columns; capability-flagged
  description?: string;
  isPii?: boolean; // for the personal data registry
  piiCategory?: PiiCategory;
}

export interface IndexDefinition {
  id: string;
  name: string;
  columns: { columnId: string; direction: 'asc' | 'desc' }[];
  unique: boolean;
  partial?: PartialIndexCondition; // capability-flagged
}

export interface ForeignKeyDefinition {
  id: string;
  name: string;
  columns: string[]; // column ids
  referencedTableId: string;
  referencedColumns: string[]; // column ids in the other table
  onDelete: 'cascade' | 'set_null' | 'restrict' | 'no_action';
  onUpdate: 'cascade' | 'set_null' | 'restrict' | 'no_action';
  // For Mongo: this is "advisory" — capability flag indicates non-enforcement
}
```

Stable identifiers (`id` fields) survive renames. The user renaming a column from `email` to `email_address` doesn't break references; the column's stable ID stays the same; queries by column name follow the rename.

### 5.3 The Edit-Validate-Preview-Apply Flow

Every schema change goes through four phases:

**1. Edit** — the user makes changes in any of the three views. Changes accumulate in the local edit buffer; nothing is persisted yet. Real-time validation flags issues as they're typed (e.g., "table name conflicts with existing", "column type not supported on Mongo"). The UI distinguishes edited-but-unsaved state visually.

**2. Validate** — the user clicks "Save" (or auto-save triggers, configurable per workspace). The platform runs the full validator: every constraint, every capability check, every naming rule. If anything fails, the save is rejected with structured errors that point at specific fields.

**3. Preview** — for changes that affect already-deployed schema, the platform generates the migration plan. The user sees: "I will run these DDL statements," "this column rename requires a backfill," "this index will lock writes for ~30 seconds." Destructive operations are highlighted in red.

**4. Apply** — the user confirms; the migration runs. The schema designer monitors progress, displays migration log lines in real-time, and confirms success or rollback. If the migration fails partway, the platform attempts rollback automatically; if rollback fails too, the UI surfaces a clear "operator action required" banner.

This is the same migration discipline the platform itself uses (from Objective 4 family), now applied to customer-defined schemas.

### 5.4 Capability-Aware UX

The schema designer reads the capability matrix from the active database adapter and adjusts the UI:

- On Postgres: the user sees full functionality — array columns, partial indexes, RLS toggles, JSON columns, foreign keys, etc.
- On MSSQL: array columns are not in the type picker; a tooltip explains why ("MSSQL doesn't support array types"); a workaround suggestion is offered ("use a JSON column or a child table")
- On Mongo: foreign keys appear with a warning banner ("Foreign keys are advisory on Mongo; the platform validates references at write time but the database doesn't enforce them")

The user experience differs by database, but the difference is honest. The user knows why and what trade-offs they're making.

For features the database doesn't support at all (e.g., spatial indexes when the customer's Mongo doesn't have geospatial enabled), the UI element is disabled with an explanation.

### 5.5 Live Schema Validation

As the user types, the schema designer validates incrementally:

- Naming: snake_case, no reserved words for the active database, no length violations
- Types: the type is valid for the active database; if not, suggest alternatives
- Foreign keys: the referenced table and columns exist; the column types match
- Indexes: the indexed columns exist; the index makes sense for the column types
- PII tagging: required for columns named like email/phone/etc. (heuristic; user can override with a justification)
- Required columns: every table has a primary key; every primary key is a non-null type

Errors appear inline with red underlines or markers; warnings appear with yellow markers; informational notes appear with blue markers. The user can save with warnings (it's their schema), but errors block save.

### 5.6 Schema Versioning and Rollback

Every successful schema apply creates a version record. The history is queryable via the data management UI:

- Version 1: initial schema with `users`, `posts`
- Version 2: added `comments` table
- Version 3: renamed `posts.title` → `posts.heading`
- ...

The user can view any historical version side-by-side with the current. The user can also **roll back** to a prior version, which generates a new migration plan that reverses the changes since that version.

Rollback for additive changes (added a table) is straightforward: drop it. Rollback for destructive changes (dropped a column with data in it) cannot recover the data; the rollback only restores the schema shape, not the data. The UI is explicit about this.

Rollback itself goes through the edit-validate-preview-apply flow. The user sees what will happen and confirms.

### 5.7 Schema Collaboration

Multiple users can edit the same schema. The platform handles concurrency via:

- **Optimistic locking on the schema document** (using the version field). Two users editing concurrently: the second to save sees a conflict; the platform shows a diff; the user merges manually or chooses one branch.
- **Real-time presence** (using the change stream layer from Objective 4d): when User A is editing, User B sees a live indicator showing User A's cursor and which fields they're touching.
- **Auto-save with conflict detection**: if auto-save is enabled, the platform attempts to save in the background; on conflict, it queues the user's edits locally until they resolve manually.

For Phase 1, the conflict resolution UX is "show diff, let user choose"; richer collaboration (operational transforms, CRDTs) is deferred unless customer demand justifies it.

### 5.8 Schema Templates

When a workspace creates its first schema, it can start blank or choose a template:

- **Blank schema** — start with one empty table named `items`
- **CRM** — `contacts`, `companies`, `deals`, `activities`
- **Blog** — `posts`, `authors`, `categories`, `comments`
- **Task tracker** — `projects`, `tasks`, `users`, `comments`
- **E-commerce** — `products`, `customers`, `orders`, `order_items`

Templates are JSON files committed in `packages/core/src/data-management/templates/`. They're a starting point — fully customizable after creation.

Custom templates: workspaces can save their schemas as templates and share them within the workspace or export them.

### 5.9 PII Tagging in Schemas

When the user creates a column whose name matches PII heuristics (`email`, `phone`, `name`, `address`, `ssn`, `tax_id`, etc.), the UI prompts the user to confirm whether the column contains PII and what category. The platform updates its **personal data registry** automatically.

This is the bridge between the schema designer and the compliance machinery from Objective 7. Customer-defined schemas participate in:

- Data subject access requests (GDPR Article 15) — exports include data from PII-tagged columns
- Erasure requests (Article 17) — eraseable PII columns get appropriately deleted or anonymized
- Audit log redaction — PII values in audit metadata are redacted on export

The user can override the heuristic ("this column called `email` is actually a system identifier, not PII") with a documented justification stored in the schema metadata.

### 5.10 Schema Documentation Generation

A schema can produce auto-generated documentation:

- **Markdown** — for inclusion in customer's project docs
- **OpenAPI / JSON Schema** — for the auto-generated APIs (Objective 12)
- **Diagram export** — PNG or SVG of the relationship view

These outputs are produced from the same schema model, ensuring documentation never drifts from reality.

---

## 6. Component Specifications

### 6.1 SchemaService

The service-layer entry point for all schema operations. Follows the canonical pattern from Objective 8.

```typescript
// packages/core/src/services/data-management/schema.service.ts

export class SchemaService {
  constructor(
    private readonly authz: AuthorizationPort,
    private readonly schemas: RepositoryPort<CustomerSchema>,
    private readonly schemaVersions: RepositoryPort<SchemaVersion>,
    private readonly introspection: SchemaIntrospectionPort,
    private readonly ddl: SchemaDdlPort,
    private readonly migration: SchemaMigrationPort,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
    private readonly approvals: ApprovalRoutingEngine,
  ) {}

  async createSchema(ctx: RequestContext, input: CreateSchemaInput): Promise<Result<CustomerSchema, AppError>>;

  async listSchemas(ctx: RequestContext, opts?: ListOptions): Promise<Result<PaginatedResult<CustomerSchema>, AppError>>;

  async getSchema(ctx: RequestContext, schemaId: string): Promise<Result<CustomerSchema, AppError>>;

  async updateSchema(ctx: RequestContext, schemaId: string, changes: SchemaChanges, expectedVersion: number): Promise<Result<CustomerSchema, AppError>>;

  async validateSchema(ctx: RequestContext, schemaId: string, proposed: SchemaChanges): Promise<Result<ValidationReport, AppError>>;

  async previewMigration(ctx: RequestContext, schemaId: string, proposed: SchemaChanges): Promise<Result<MigrationPreview, AppError>>;

  async applyChanges(ctx: RequestContext, schemaId: string, proposed: SchemaChanges, expectedVersion: number): Promise<Result<MigrationResult, AppError>>;

  async listVersions(ctx: RequestContext, schemaId: string): Promise<Result<SchemaVersion[], AppError>>;

  async rollbackToVersion(ctx: RequestContext, schemaId: string, targetVersion: number): Promise<Result<MigrationResult, AppError>>;

  async exportSchema(ctx: RequestContext, schemaId: string, format: 'json' | 'yaml' | 'markdown'): Promise<Result<string, AppError>>;

  async importSchema(ctx: RequestContext, input: ImportSchemaInput): Promise<Result<CustomerSchema, AppError>>;

  async deleteSchema(ctx: RequestContext, schemaId: string, options: DeleteSchemaOptions): Promise<Result<void, AppError>>;
}
```

Every method authorizes, audits, and follows the canonical pattern. The `applyChanges` and `rollbackToVersion` methods route through the approval engine when the workspace's approval configuration requires it.

### 6.2 The Schema Validator

`packages/core/src/services/data-management/schema-validator.ts`:

```typescript
export interface SchemaValidator {
  validate(schema: CustomerSchema, proposed: SchemaChanges, capabilities: CapabilitySet): ValidationReport;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

export interface ValidationIssue {
  path: string; // e.g., 'tables[0].columns[2]'
  field?: string; // e.g., 'name'
  code: string; // stable for programmatic handling
  message: string;
  suggestion?: string;
}
```

The validator runs the rules described in Section 5.5 in a deterministic order. For every issue, it produces a structured `ValidationIssue` that the UI can map to a specific form field.

### 6.3 The Migration Planner

`packages/core/src/services/data-management/migration-planner.ts`:

```typescript
export interface MigrationPlanner {
  plan(current: CustomerSchema, proposed: SchemaChanges, capabilities: CapabilitySet): MigrationPlan;
}

export interface MigrationPlan {
  steps: MigrationStep[];
  estimatedDuration: number; // milliseconds; best-effort
  destructiveChanges: DestructiveChange[];
  blockingChanges: BlockingChange[]; // changes that prevent reads/writes during migration
  dataLossRisk: boolean;
}

export interface MigrationStep {
  id: string;
  description: string;
  ddl?: string; // the SQL or Mongo command, for SQL/Mongo dialects
  estimatedDuration: number;
  reversible: boolean;
}
```

The planner produces a human-readable preview AND the executable steps. The user sees the preview; the executor runs the steps.

### 6.4 The Schema Designer UI Components

The UI lives in `apps/web/src/data-management/schema-designer/`:

- `SchemaDesigner.tsx` — the main page, wires up the three views and the save flow
- `views/DiagramView.tsx` — `@xyflow/react`-based relationship diagram
- `views/TableView.tsx` — list-of-tables with expand/collapse
- `views/CodeView.tsx` — Monaco-editor-based YAML/JSON editor
- `dialogs/AddTableDialog.tsx`
- `dialogs/AddColumnDialog.tsx`
- `dialogs/EditForeignKeyDialog.tsx`
- `panels/ValidationPanel.tsx` — shows current errors/warnings
- `panels/HistoryPanel.tsx` — schema version history
- `flows/MigrationPreviewDialog.tsx` — shows the migration plan
- `flows/MigrationProgressDialog.tsx` — real-time migration progress

Each component is purely presentational; data fetching and mutations go through hooks that call the service layer via the API.

### 6.5 The Storage Schema for Customer Schemas

In the platform's primary database, a new set of tables/collections (themselves migrated via the platform's own migrations from Objective 4):

```typescript
// Logical schema (translated per database)

customer_schemas: {
  ...standardColumns,
  workspace_id: uuid,
  name: string(255),
  slug: string(100),
  description: text?,
  database_driver: enum,
  schema_definition: json,         // the full TableDefinition[] etc.
  current_version: int,
  last_deployed_version: int?,
  last_deployed_at: timestamp?,
}
unique: [workspace_id, slug]

customer_schema_versions: {
  ...standardColumns,
  schema_id: uuid,
  version: int,
  schema_definition: json,         // immutable snapshot
  change_summary: text,
  applied_by: uuid,
  applied_at: timestamp?,
  rolled_back_at: timestamp?,
}
unique: [schema_id, version]

customer_schema_migrations: {
  ...standardColumns,
  schema_id: uuid,
  version_from: int,
  version_to: int,
  plan: json,                      // the MigrationPlan
  status: enum('planned', 'running', 'succeeded', 'failed', 'rolled_back'),
  started_at: timestamp?,
  completed_at: timestamp?,
  error_details: json?,
}
```

These tables hold the platform's metadata about customer schemas. The customer's actual tables live in the database in a separate logical schema.

### 6.6 Customer Tables in the Database

When a schema is applied, the platform creates real tables in the customer's chosen database, prefixed/scoped appropriately:

- **Postgres**: in a schema named `cust_<workspace_slug>` (e.g., `cust_acme.users`); the platform's own tables are in `public` or a `platform` schema
- **MSSQL**: in a schema named `cust_<workspace_slug>` (MSSQL supports schemas); same separation
- **Mongo**: collections prefixed with `cust_<workspace_slug>__` (e.g., `cust_acme__users`); the platform's collections use a different prefix (`platform_*`)

This separation is critical: it ensures the platform's own tables can never be accidentally modified by a customer's schema operation, and customer tables can never be confused for platform tables.

For Postgres specifically, the customer schema gets its own role and grants: a `cust_<workspace>_app` role for runtime access, a `cust_<workspace>_migrate` role for DDL. This way, even if there's a SQL injection in customer-generated API code (Objective 12), it can only affect that workspace's tables, not the platform's.

### 6.7 Permissions for Schema Operations

New permissions added to the vocabulary from Objective 6:

- `schema.create`
- `schema.read`
- `schema.update`
- `schema.delete`
- `schema.deploy` (apply migrations)
- `schema.rollback`
- `schema.export`
- `schema.import`

The default mapping to roles:

- `workspace_owner`, `workspace_admin`: all schema permissions
- `architect`: all schema permissions (architects own data design in the master plan)
- `developer`: read, export
- `qa`, `reviewer`, `viewer`: read, export
- Custom roles: configurable

Workspace approval routing applies to `schema.deploy` and `schema.rollback`: solo workflows allow the architect (or owner) to deploy directly; enterprise workflows route to a configured approver list.

### 6.8 Audit Events

Schema-specific audit events added to the catalog:

```
data_management.schema.created
data_management.schema.updated
data_management.schema.deleted
data_management.schema.exported
data_management.schema.imported
data_management.schema.deployed         (a successful migration)
data_management.schema.deploy_failed
data_management.schema.rolled_back
data_management.schema.validation_failed (when a save attempt fails validation)
```

Each event captures the schema_id, version_from, version_to, change_summary, actor, and outcome.

### 6.9 Observability

Schema-specific metrics:

- `platform_schema_operations_total{operation, outcome, driver}` — counter
- `platform_schema_migration_duration_seconds{driver}` — histogram
- `platform_schema_validation_failures_total{driver, error_code}` — counter
- `platform_active_schemas` — gauge
- `platform_active_customer_tables` — gauge (sum across workspaces)

Slow migrations (> 30s) emit warnings; > 5min emit errors. Failed migrations always emit errors.

### 6.10 Operational Runbooks

New files in `docs/runbooks/`:

- `schema-stuck-migration.md` — what to do when a schema migration is stuck (database lock, partial state, etc.)
- `schema-rollback-data-loss.md` — when a rollback would lose data, the operator's options
- `schema-cross-workspace-isolation.md` — how to verify customer schemas can't leak across workspaces
- `schema-import-from-existing.md` — onboarding a customer with existing tables (the "introspect this database and create a schema" flow)
- `schema-export-for-handoff.md` — exporting a schema for the customer to take elsewhere

---

## 7. Implementation Order

1. **Schema model** — define `CustomerSchema`, `TableDefinition`, etc., with full TypeScript types and zod schemas.

2. **Storage schema** — migrations for `customer_schemas`, `customer_schema_versions`, `customer_schema_migrations` tables on all three database adapters.

3. **Customer schema/database isolation** — the per-workspace schemas/prefixes; verified by isolation tests.

4. **SchemaService** — the canonical service following the Objective 8 pattern; all methods listed in Section 6.1.

5. **SchemaValidator** — the rule engine that drives live validation.

6. **MigrationPlanner** — produces previewable migration plans.

7. **Migration executor** — runs the plan; integrates with the SchemaMigrationPort.

8. **Audit events** — added to the catalog; emitted from each service operation.

9. **Permissions** — added to the vocabulary; default role grants updated.

10. **Approval routing integration** — schema deploy and rollback go through the approval engine.

11. **Schema designer UI** — Diagram view, Table view, Code view; the dialogs and flows.

12. **Schema templates** — a few starter templates committed.

13. **Schema export and import** — markdown, JSON, YAML formats.

14. **PII tagging integration** — schema columns tagged as PII update the personal data registry.

15. **Conformance tests** — schema lifecycle tested across all three database adapters.

16. **Cross-tenant isolation tests** — customer A's schema operations cannot affect customer B's tables.

17. **Documentation** — runbooks, ADRs, user-facing docs.

18. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0093: Customer Schemas in Separate Database Namespaces** — physical isolation between platform tables and customer tables; how this works on each database
- **ADR-0094: Schema Versioning with Immutable History** — every change tracked, rollback supported
- **ADR-0095: Edit-Validate-Preview-Apply Flow** — the four-phase discipline for schema changes
- **ADR-0096: Capability-Aware UX** — the UI adapts honestly to database limitations
- **ADR-0097: Schema as the API Surface** — schema definitions drive the auto-generated APIs (forward reference to Objective 12)

---

## 9. Verification Steps

1. **Schema CRUD operations** work end-to-end for a single user in a single workspace.

2. **Schema validation** catches all the rule violations: invalid names, unsupported types, missing primary keys, unknown foreign key references.

3. **Migration preview** correctly shows what will happen, including data loss warnings for destructive changes.

4. **Apply migration** runs successfully for: add table, add column, add index, add foreign key, rename table, rename column, change column type (where supported), drop column, drop table.

5. **Migration rollback** works for additive changes; gracefully fails with explanation for destructive changes.

6. **Cross-tenant isolation** — workspace A's schema operations cannot read or write workspace B's customer tables; tests prove this on all three databases.

7. **Capability-aware UX** — UI on Postgres shows array column option; on MSSQL the option is disabled with explanation; on Mongo it's enabled (Mongo supports arrays).

8. **Foreign key advisory mode on Mongo** — UI shows a warning when adding FKs on Mongo schema; the metadata is stored; runtime FK enforcement at the application layer is documented (full enforcement deferred to a later objective).

9. **Schema versioning** — every successful apply creates a new version; history is queryable; rollback creates a new version (going forward, not editing history).

10. **Schema export/import round-trip** — export a schema; import it into another workspace; the structure matches.

11. **PII tagging** — adding a column called `email` prompts for PII confirmation; confirmed columns appear in the personal data registry.

12. **Templates** — creating a schema from a template produces a valid initial schema.

13. **Concurrent edit detection** — two users editing simultaneously: the second to save sees a conflict diff.

14. **Approval routing for schema deploy** — solo workspace deploys directly; enterprise workspace with architect-approval-required routes correctly.

15. **Audit events emitted** — every schema operation produces the expected audit entry.

16. **Performance** — schema list, get, update operations p95 < 200ms even with workspaces having dozens of schemas and dozens of tables each.

17. **Migration stuck recovery** — simulate a hung migration; the runbook procedure recovers.

18. **Customer table isolation in Postgres** — verify the `cust_<workspace>_app` role can read/write its workspace's tables but NOT another workspace's, and NOT the platform's tables.

19. **Schema designer UI accessibility** — keyboard navigation through diagram, table, and code views; screen reader announces meaningful structure; passes axe-core in CI.

20. **Three-view consistency** — making a change in Diagram view shows up correctly in Table and Code views; same for changes in Table or Code views.

If all 20 pass, the objective is met.

---

## 10. Definition of Done

**Service Layer**

- [ ] SchemaService implemented with all methods from Section 6.1
- [ ] SchemaValidator implemented with all rules from Section 5.5
- [ ] MigrationPlanner implemented with preview generation
- [ ] Approval routing integrated for deploy and rollback
- [ ] Conformance tests pass on all three database adapters

**Data Storage**

- [ ] Storage schema migrations applied (customer_schemas, customer_schema_versions, customer_schema_migrations)
- [ ] Per-workspace customer database namespaces (Postgres schemas, MSSQL schemas, Mongo prefixes)
- [ ] Per-workspace database roles created on workspace creation (Postgres/MSSQL)

**UI**

- [ ] Diagram view (xyflow-based)
- [ ] Table view (list-of-tables)
- [ ] Code view (Monaco-based YAML/JSON editor)
- [ ] All dialogs (AddTable, AddColumn, EditForeignKey)
- [ ] Validation panel with inline errors/warnings
- [ ] History panel with version diffs
- [ ] Migration preview dialog
- [ ] Migration progress dialog with real-time updates
- [ ] Capability-aware UI (features disabled/explained per active database)

**Lifecycle Operations**

- [ ] Create, read, update, delete schemas
- [ ] Validate schema
- [ ] Preview migration
- [ ] Apply migration
- [ ] Rollback to version
- [ ] Export (markdown, JSON, YAML)
- [ ] Import
- [ ] Schema templates

**Quality**

- [ ] Cross-tenant isolation tests pass
- [ ] Cross-database conformance tests pass
- [ ] Performance baselines met
- [ ] Accessibility (axe-core) passes on schema designer pages
- [ ] PII tagging integrated with personal data registry

**Permissions**

- [ ] Schema permissions added to vocabulary
- [ ] Default role grants updated
- [ ] Approval routing for deploy/rollback

**Audit & Observability**

- [ ] Schema-specific audit events emitted
- [ ] Schema-specific metrics emitted
- [ ] Slow operation warnings configured

**Documentation**

- [ ] ADRs 0093–0097 written and Accepted
- [ ] All runbooks in Section 6.10 written
- [ ] User-facing documentation for the schema designer
- [ ] Capability matrix updated with schema-feature mapping

**Verification**

- [ ] All 20 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Storing customer schema definitions in the customer's chosen database.** They live in the platform's primary database; the customer's database holds the materialized tables only.
- **Mixing platform tables and customer tables in the same namespace.** Always separate schemas (Postgres/MSSQL) or prefixes (Mongo). Always.
- **Allowing customer schema operations to use the platform's migration user.** Customer schemas use customer-scoped database roles; the platform's migration user is for the platform's own migrations.
- **Skipping the validate-preview-apply phases for "minor" changes.** Every change goes through the four phases. Adding an index is "minor" until it locks a 100M-row table for an hour.
- **Letting customer-defined naming conflict with reserved words.** The validator catches reserved words per database; never bypass.
- **Hiding capability differences in the UI to make it look uniform.** The UI is honest. MSSQL doesn't have arrays; the UI says so. Pretending otherwise produces failed migrations and frustrated users.
- **Editing schema history.** New versions go forward. Past versions are immutable. Rollback is a new version that reverses changes; it doesn't edit the past.
- **Allowing two people to edit the same schema without conflict detection.** Even in Phase 1. Optimistic locking + diff is the minimum.
- **Skipping the cross-tenant isolation tests because "obviously it works."** The whole product fails if a customer can read another customer's data. Test it.
- **Using the customer's chosen database name as the schema slug.** The slug is a platform identifier; the database namespace name is derived from it; they're related but the user-facing name is the customer's choice.
- **Treating the schema designer as the only path to schema creation.** APIs (Objective 19, the public SDK) and AI-generated schemas (a later integration) also create schemas. The SchemaService is the single authority; UI/AI/API all go through it.

---

## 12. Open Questions for Confirmation Before Starting

1. **Schema slug uniqueness scope** — proposing per-workspace, not per-installation. A workspace named "Acme" can have a schema named "main" without conflicting with another workspace's "main" schema. Confirmed?

2. **Customer schema namespace naming** — proposing `cust_<workspace_slug>` for Postgres/MSSQL schemas, `cust_<workspace_slug>__` prefix for Mongo collections. Verbose but unambiguous. Acceptable?

3. **Foreign keys on Mongo** — proposing "advisory" mode: stored in metadata, displayed in UI with a warning, NOT enforced by the database. Application-layer enforcement deferred to a later objective. Confirmed?

4. **Templates included in v1** — proposing 5 starter templates (CRM, blog, tasks, e-commerce, blank). Sufficient? Or include more (HR, support tickets, events)?

5. **Schema collaboration in v1** — proposing optimistic locking + manual conflict resolution. Real-time collaborative editing (CRDT-style) deferred. Acceptable?

6. **PII tagging mandatoriness** — proposing heuristic that prompts the user, not blocks them. The user can mark a column as not-PII with a justification. Stricter alternative: PII heuristic blocks save until the user explicitly confirms one way or the other. Recommendation: prompt, not block; respect the user.

7. **Schema designer UI location** — proposing `apps/web/src/data-management/schema-designer/` as a feature folder within the web app. Or should it be its own sub-app for code-splitting? Recommendation: feature folder for now; sub-app if bundle size becomes a concern.

---

## 13. What Comes Next

With Objective 11 complete, customers can:

- Define schemas visually for their chosen database
- See exactly what the platform will do before applying changes
- Roll back when needed
- Collaborate (with conflict detection)
- Tag PII appropriately for compliance
- Export and import schemas

But schemas alone aren't useful — they need APIs, real-time updates, a way to browse data, a way to manage files, a way to authenticate users, a query console.

**Objective 12: Auto-Generated REST APIs** is next. Given a customer schema, expose typed REST endpoints (CRUD per table, filtering via the Filter AST, pagination, sorting). Permissions enforced via the platform's RBAC. OpenAPI documentation auto-generated.

**Objective 13: Auto-Generated GraphQL APIs** follows — same data, GraphQL surface, with subscriptions for real-time queries.

**Objective 14: Real-Time Subscriptions** — uses the change streams from Objective 4d to expose live updates over WebSocket.

**Objective 15: Storage Browser** — UI on top of `ObjectStoragePort` for file management.

**Objective 16: Auth & User Management UI** — the customer-facing surface of the auth system from Objective 5.

**Objective 17: Query Console** — SQL/Mongo console with safety rails (read-only by default, query timeouts, result size limits).

**Objective 18: Data Browser** — table viewer, row editor, CSV import/export.

**Objective 19: Public SDK** — the "Supabase client equivalent" that customer developers use to build applications on top of the platform.

By Objective 19, the Data Management Module is a complete product on its own — sellable to Microsoft houses as "Supabase for MSSQL," sellable to anyone running Mongo as "Supabase for Mongo," sellable to Postgres customers as "self-hosted Supabase you actually own."

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on to Objective 12._
