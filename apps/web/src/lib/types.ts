/**
 * Client-side type mirrors of the backend schema model.
 * These must match what SchemaService returns via the REST API (Objective 12).
 * Source of truth: packages/core/src/services/data-management/schema-model.ts
 */

export type DatabaseDriver = 'postgres' | 'mssql' | 'mongo';

export type PiiCategory =
  | 'contact'
  | 'identification'
  | 'financial'
  | 'health'
  | 'behavioral'
  | 'location'
  | 'credential'
  | 'other';

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

export type DefaultValueExpression =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'function'; name: string }
  | { kind: 'sequence' };

export type GeneratedExpression = {
  expression: string;
  stored: boolean;
};

export interface ColumnDefinition {
  id: string;
  name: string;
  type: NormalizedType;
  nullable: boolean;
  defaultValue?: DefaultValueExpression;
  generated?: GeneratedExpression;
  description?: string;
  isPii?: boolean;
  piiCategory?: PiiCategory;
  piiOverrideReason?: string;
  /** UI-only: position metadata for diagram layout */
  _uiMeta?: Record<string, unknown>;
}

export type PrimaryKeyDefinition =
  | { kind: 'single'; columnId: string }
  | { kind: 'composite'; columnIds: string[] };

export interface IndexDefinition {
  id: string;
  name: string;
  columnIds: string[];
  unique: boolean;
  partial?: string;
  using?: 'btree' | 'hash' | 'gin' | 'gist';
  description?: string;
}

export interface ForeignKeyDefinition {
  id: string;
  name: string;
  columnIds: string[];
  referencedTableId: string;
  referencedColumnIds: string[];
  onDelete?: 'cascade' | 'restrict' | 'set_null' | 'set_default' | 'no_action';
  onUpdate?: 'cascade' | 'restrict' | 'set_null' | 'set_default' | 'no_action';
  advisory?: boolean; // true on Mongo — no referential integrity enforced
}

export interface ConstraintDefinition {
  id: string;
  name: string;
  kind: 'check' | 'unique';
  expression?: string; // for check constraints
  columnIds?: string[]; // for unique constraints
}

export interface RlsConfig {
  enabled: boolean;
  policies: RlsPolicy[];
}

export interface RlsPolicy {
  id: string;
  name: string;
  command: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  permissive: boolean;
  using?: string;
  withCheck?: string;
}

export interface TableDefinition {
  id: string;
  name: string;
  description?: string;
  columns: ColumnDefinition[];
  primaryKey: PrimaryKeyDefinition;
  indexes: IndexDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  constraints: ConstraintDefinition[];
  rowLevelSecurity?: RlsConfig;
  changeStream?: { enabled: boolean };
  /** UI-only: x/y position for diagram view */
  _diagramPosition?: { x: number; y: number };
}

export interface SchemaMetadata {
  createdAt: string; // ISO string from API
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  lastDeployedAt?: string;
  deployedVersion?: number;
}

export interface CustomerSchema {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  version: number;
  databaseDriver: DatabaseDriver;
  tables: TableDefinition[];
  metadata: SchemaMetadata;
}

export interface SchemaVersion {
  version: number;
  schemaId: string;
  tables: TableDefinition[];
  createdAt: string;
  createdBy: string;
  description?: string;
}

// Validation types

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  path: string;
  field?: string;
  code: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

// Migration types

export interface DestructiveChange {
  description: string;
  dataLoss: boolean;
}

export interface BlockingChange {
  description: string;
  estimatedLockDurationMs: number;
}

export interface MigrationStep {
  id: string;
  description: string;
  ddl?: string;
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

export interface MigrationResult {
  migrationId: string;
  schemaId: string;
  outcome: 'succeeded' | 'failed' | 'rolled_back';
  stepsExecuted: number;
  errorMessage?: string;
  startedAt: string;
  completedAt: string;
  newVersion?: number;
}

// Input types (sent to API)

export interface CreateSchemaInput {
  name: string;
  slug: string;
  description?: string;
  databaseDriver: DatabaseDriver;
  templateId?: string;
}

export interface UpdateSchemaInput {
  schemaId: string;
  expectedVersion: number;
  changes: {
    name?: string;
    description?: string;
    tables?: TableDefinition[];
  };
}

export interface SchemaChanges {
  name?: string;
  description?: string;
  tables?: TableDefinition[];
}

export interface ImportSchemaInput {
  format: 'json' | 'yaml';
  content: string;
  name?: string;
  slug?: string;
  databaseDriver: DatabaseDriver;
}

// API response wrapper

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasNextPage: boolean;
  nextCursor?: string;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  metadata?: Record<string, unknown>;
}

// Template IDs (from Objective 11 backend)

export type TemplateId = 'blank' | 'blog' | 'crm' | 'task-tracker' | 'ecommerce';

export interface SchemaTemplate {
  id: TemplateId;
  name: string;
  description: string;
  tableCount: number;
  previewTables: string[];
}

export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start with an empty schema and add your own tables.',
    tableCount: 0,
    previewTables: [],
  },
  {
    id: 'blog',
    name: 'Blog',
    description: 'Posts, authors, categories, tags, and comments.',
    tableCount: 5,
    previewTables: ['posts', 'authors', 'categories'],
  },
  {
    id: 'crm',
    name: 'CRM',
    description: 'Contacts, organizations, deals, and activities.',
    tableCount: 6,
    previewTables: ['contacts', 'organizations', 'deals'],
  },
  {
    id: 'task-tracker',
    name: 'Task Tracker',
    description: 'Projects, tasks, assignees, milestones, and comments.',
    tableCount: 5,
    previewTables: ['projects', 'tasks', 'assignees'],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    description: 'Products, categories, orders, customers, and inventory.',
    tableCount: 7,
    previewTables: ['products', 'orders', 'customers'],
  },
];

// Capability flags per database driver

export interface DriverCapabilities {
  arrays: boolean;
  jsonb: boolean;
  fullTextSearch: boolean;
  rowLevelSecurity: boolean;
  generatedColumns: boolean;
  checkConstraints: boolean;
  partialIndexes: boolean;
  foreignKeyEnforcement: boolean;
  transactions: boolean;
  changeStreams: boolean;
}

export const DRIVER_CAPABILITIES: Record<DatabaseDriver, DriverCapabilities> = {
  postgres: {
    arrays: true,
    jsonb: true,
    fullTextSearch: true,
    rowLevelSecurity: true,
    generatedColumns: true,
    checkConstraints: true,
    partialIndexes: true,
    foreignKeyEnforcement: true,
    transactions: true,
    changeStreams: false,
  },
  mssql: {
    arrays: false,
    jsonb: false,
    fullTextSearch: true,
    rowLevelSecurity: true,
    generatedColumns: true,
    checkConstraints: true,
    partialIndexes: true,
    foreignKeyEnforcement: true,
    transactions: true,
    changeStreams: false,
  },
  mongo: {
    arrays: true,
    jsonb: true,
    fullTextSearch: true,
    rowLevelSecurity: false,
    generatedColumns: false,
    checkConstraints: false,
    partialIndexes: true,
    foreignKeyEnforcement: false,
    transactions: true,
    changeStreams: true,
  },
};
