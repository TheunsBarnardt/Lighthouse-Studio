import { z } from 'zod';

// ── Normalized type system ─────────────────────────────────────────────────────
// Finite set of types the platform understands across all three databases.
// Capability flags determine which types are available on each driver.

export type NormalizedType =
  | { kind: 'string'; length?: number }
  | { kind: 'text' }
  | { kind: 'integer' }
  | { kind: 'bigint' }
  | { kind: 'decimal'; precision: number; scale: number }
  | { kind: 'boolean' }
  | { kind: 'date' }
  | { kind: 'timestamp' }
  | { kind: 'timestamp_tz' }
  | { kind: 'uuid' }
  | { kind: 'binary' }
  | { kind: 'json' }
  | { kind: 'array'; elementType: NormalizedType };

// ── PII ────────────────────────────────────────────────────────────────────────

export type PiiCategory =
  | 'contact' // email, phone, address
  | 'identification' // ssn, passport, tax_id, national_id
  | 'financial' // credit_card, bank_account, salary
  | 'health' // medical, biometric
  | 'behavioral' // browsing_history, purchase_history
  | 'location' // gps, ip_address
  | 'credential' // password, api_key, token
  | 'other';

// Heuristic column names that trigger a PII confirmation prompt
export const PII_HEURISTIC_NAMES: ReadonlySet<string> = new Set([
  'email',
  'email_address',
  'phone',
  'phone_number',
  'mobile',
  'address',
  'street',
  'postal_code',
  'zip',
  'zip_code',
  'ssn',
  'national_id',
  'passport',
  'tax_id',
  'credit_card',
  'card_number',
  'bank_account',
  'iban',
  'salary',
  'password',
  'password_hash',
  'secret',
  'api_key',
  'token',
  'first_name',
  'last_name',
  'full_name',
  'display_name',
  'birth_date',
  'date_of_birth',
  'dob',
  'ip_address',
  'latitude',
  'longitude',
  'location',
]);

// ── Default value expressions ──────────────────────────────────────────────────

export type DefaultValueExpression =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'function'; name: 'now' | 'gen_uuid' | 'gen_random_uuid' | 'current_user' }
  | { kind: 'sequence' }; // auto-increment / serial

// ── Generated (computed) columns ───────────────────────────────────────────────

export interface GeneratedExpression {
  expression: string; // DB-specific expression; stored verbatim
  stored: boolean; // STORED vs VIRTUAL; capability-flagged
}

// ── Primary key ────────────────────────────────────────────────────────────────

export type PrimaryKeyDefinition =
  | { kind: 'single'; columnId: string }
  | { kind: 'composite'; columnIds: string[] };

// ── Full-text search config ────────────────────────────────────────────────────

export interface FullTextSearchConfig {
  columnIds: string[];
  language?: string; // e.g. 'english' for Postgres
}

// ── Row-level security config (Postgres only; capability-flagged) ──────────────

export interface RlsConfig {
  enabled: boolean;
  policies: RlsPolicy[];
}

export interface RlsPolicy {
  id: string;
  name: string;
  command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  using?: string; // SQL expression
  withCheck?: string;
}

// ── Partial index predicate (capability-flagged) ───────────────────────────────

export interface PartialIndexCondition {
  expression: string; // stored verbatim; DB-specific
}

// ── Column ─────────────────────────────────────────────────────────────────────

export interface ColumnDefinition {
  /** Stable identifier — survives renames. */
  id: string;
  name: string;
  type: NormalizedType;
  nullable: boolean;
  defaultValue?: DefaultValueExpression;
  generated?: GeneratedExpression;
  description?: string;
  isPii?: boolean;
  piiCategory?: PiiCategory;
  /** User-supplied justification when overriding the PII heuristic. */
  piiOverrideReason?: string;
}

// ── Index ──────────────────────────────────────────────────────────────────────

export interface IndexDefinition {
  id: string;
  name: string;
  columns: { columnId: string; direction: 'asc' | 'desc' }[];
  unique: boolean;
  partial?: PartialIndexCondition;
}

// ── Foreign key ────────────────────────────────────────────────────────────────

export interface ForeignKeyDefinition {
  id: string;
  name: string;
  /** Column IDs in this table. */
  columns: string[];
  referencedTableId: string;
  /** Column IDs in the referenced table. */
  referencedColumns: string[];
  onDelete: 'cascade' | 'set_null' | 'restrict' | 'no_action';
  onUpdate: 'cascade' | 'set_null' | 'restrict' | 'no_action';
  /** True on MongoDB where FK semantics are advisory, not database-enforced. */
  advisory?: boolean;
}

// ── Constraint ─────────────────────────────────────────────────────────────────

export interface ConstraintDefinition {
  id: string;
  name: string;
  type: 'check' | 'unique';
  expression?: string; // for CHECK constraints
  columnIds?: string[]; // for UNIQUE constraints
}

// ── Table ──────────────────────────────────────────────────────────────────────

export interface CustomerTableDefinition {
  /** Stable identifier — survives renames. */
  id: string;
  name: string;
  description?: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  constraints: ConstraintDefinition[];
  primaryKey: PrimaryKeyDefinition;
  fullTextSearch?: FullTextSearchConfig;
  changeStream?: { enabled: boolean };
  /** Postgres/MSSQL only; null/undefined on Mongo. */
  rowLevelSecurity?: RlsConfig;
}

// ── Customer schema ────────────────────────────────────────────────────────────

export type DatabaseDriver = 'postgres' | 'mssql' | 'mongo';

export interface CustomerSchema {
  id: string;
  workspaceId: string;
  name: string;
  /** URL-safe identifier; unique within workspace. */
  slug: string;
  description?: string;
  /** Optimistic locking version. Increments on every successful save. */
  version: number;
  databaseDriver: DatabaseDriver;
  tables: CustomerTableDefinition[];
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string;
    lastDeployedAt?: Date;
    /** Version that was last successfully deployed (may lag behind `version`). */
    deployedVersion?: number;
  };
}

// ── Schema version record ──────────────────────────────────────────────────────

export interface SchemaVersion {
  id: string;
  schemaId: string;
  version: number;
  /** Immutable snapshot of the full schema at this version. */
  schemaDefinition: CustomerSchema;
  changeSummary: string;
  appliedBy: string;
  appliedAt?: Date;
  rolledBackAt?: Date;
}

// ── Schema migration record ────────────────────────────────────────────────────

export type MigrationStatus = 'planned' | 'running' | 'succeeded' | 'failed' | 'rolled_back';

export interface SchemaMigrationRecord {
  id: string;
  schemaId: string;
  versionFrom: number;
  versionTo: number;
  plan: MigrationPlan;
  status: MigrationStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorDetails?: Record<string, unknown>;
}

// ── Change input types ─────────────────────────────────────────────────────────

/** A partial update to a CustomerSchema. Only the provided fields are changed. */
export interface SchemaChanges {
  name?: string;
  description?: string;
  tables?: CustomerTableDefinition[];
}

// ── Service input types ────────────────────────────────────────────────────────

export const CreateSchemaInputSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, 'Slug must be lowercase alphanumeric with underscores'),
  description: z.string().max(2000).optional(),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  initialTables: z.array(z.any()).optional(), // validated by SchemaValidator after parse
  templateId: z.string().optional(),
  /** Workspace URL slug — used to initialize the per-workspace DB namespace on postgres/mssql. */
  workspaceSlug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

export type CreateSchemaInput = z.infer<typeof CreateSchemaInputSchema>;

export const UpdateSchemaInputSchema = z.object({
  schemaId: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
  changes: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    tables: z.array(z.any()).optional(),
  }),
});

export type UpdateSchemaInput = z.infer<typeof UpdateSchemaInputSchema>;

export const DeleteSchemaOptionsSchema = z.object({
  schemaId: z.string().uuid(),
  expectedVersion: z.number().int().min(1),
  /** When true, also drop the customer tables from the database. */
  dropCustomerTables: z.boolean().default(false),
  reason: z.string().max(500).optional(),
});

export type DeleteSchemaOptions = z.infer<typeof DeleteSchemaOptionsSchema>;

export const ImportSchemaInputSchema = z.object({
  format: z.enum(['json', 'yaml']),
  content: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  slug: z.string().optional(),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
});

export type ImportSchemaInput = z.infer<typeof ImportSchemaInputSchema>;

// ── Validation types ───────────────────────────────────────────────────────────

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  /** e.g. 'tables[0].columns[2]' */
  path: string;
  /** e.g. 'name' */
  field?: string;
  /** Stable code for programmatic handling. */
  code: string;
  severity: IssueSeverity;
  message: string;
  suggestion?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

// ── Migration plan types ───────────────────────────────────────────────────────

export interface DestructiveChange {
  description: string;
  /** When true, rolling back will NOT recover data. */
  dataLoss: boolean;
}

export interface BlockingChange {
  description: string;
  /** Estimated milliseconds the operation will block reads/writes. */
  estimatedBlockMs: number;
}

export interface MigrationStep {
  id: string;
  description: string;
  /** The DDL/command to execute. */
  ddl?: string;
  /** The DDL/command to reverse this step. */
  reverseDdl?: string;
  estimatedDurationMs: number;
  reversible: boolean;
}

export interface MigrationPlan {
  steps: MigrationStep[];
  estimatedTotalDurationMs: number;
  destructiveChanges: DestructiveChange[];
  blockingChanges: BlockingChange[];
  dataLossRisk: boolean;
}

export interface MigrationPreview {
  plan: MigrationPlan;
  fromVersion: number;
  toVersion: number;
  requiresApproval: boolean;
}

export type MigrationOutcome = 'succeeded' | 'failed' | 'rolled_back';

export interface MigrationResult {
  migrationId: string;
  schemaId: string;
  outcome: MigrationOutcome;
  stepsExecuted: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt: Date;
  newVersion?: number;
}

// ── List options ────────────────────────────────────────────────────────────────

export interface ListOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
