import { z } from 'zod';

// ── Capability context ────────────────────────────────────────────────────────

export const CapabilityContextSchema = z.object({
  driver: z.enum(['postgres', 'mssql', 'mongo']),
  capabilities: z.object({
    arrayColumns: z.boolean(),
    jsonColumns: z.boolean(),
    foreignKeysEnforced: z.boolean(),
    fullTextSearch: z.boolean(),
    geospatial: z.boolean(),
    materializedViews: z.boolean(),
    triggers: z.boolean(),
    storedProcedures: z.boolean(),
  }),
  reservedWords: z.array(z.string()),
  identifierMaxLength: z.number(),
  preferredIndexTypes: z.array(z.string()),
});
export type CapabilityContext = z.infer<typeof CapabilityContextSchema>;

// ── Entity extraction ─────────────────────────────────────────────────────────

export interface ExtractedEntity {
  name: string;
  description: string;
  suggestedTableName: string;
  attributes: string[];
  prdReferences: string[];
}

export interface ExtractedRelationship {
  from: string;
  to: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  description: string;
  prdReferences: string[];
}

export interface EntityExtractionRecord {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  ambiguitiesFlagged: string[];
  reasoning: string;
}

// ── Column definition (schema synthesis layer) ────────────────────────────────

export interface SynthesizedColumn {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  description: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
  piiCategories: string[];
  reasoning: string;
  prdReferences: string[];
}

// ── Table definition ──────────────────────────────────────────────────────────

export interface SynthesizedTable {
  id: string;
  name: string;
  description: string;
  columns: SynthesizedColumn[];
  indexes: SynthesizedIndex[];
  reasoning: string;
  prdReferences: string[];
  isJunctionTable: boolean;
}

export interface SynthesizedIndex {
  id: string;
  columnNames: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'unique';
  reasoning: string;
}

// ── Coverage ──────────────────────────────────────────────────────────────────

export interface CoverageReport {
  prdEntitiesCovered: { entityName: string; tableId: string }[];
  prdEntitiesUncovered: { entityName: string; reason: string }[];
  prdRequirementsCovered: { requirementId: string; supportingTableIds: string[] }[];
  prdRequirementsUnsupported: { requirementId: string; missingSchema: string }[];
  coverageRate: number;
  checkedAt: Date;
}

// ── PII detection ─────────────────────────────────────────────────────────────

export interface PiiDetection {
  tableId: string;
  columnId: string;
  columnName: string;
  categories: string[];
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PiiConfirmation {
  tableId: string;
  columnId: string;
  accepted: boolean;
  modifiedCategories?: string[];
  confirmedAt?: Date;
}

export interface PiiDetectionRecord {
  detections: PiiDetection[];
  confirmations: PiiConfirmation[];
}

// ── Index recommendations ─────────────────────────────────────────────────────

export interface IndexRecommendation {
  tableId: string;
  columnIds: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'unique';
  reasoning: string;
  estimatedBenefit: 'high' | 'medium' | 'low';
  prdJustification?: string;
}

// ── Schema diff ───────────────────────────────────────────────────────────────

export interface SchemaDiff {
  newTables: SynthesizedTable[];
  modifiedTables: { tableId: string; tableName: string; newColumns: SynthesizedColumn[] }[];
  newIndexes: { tableId: string; index: SynthesizedIndex }[];
  newForeignKeys: { fromTable: string; fromColumn: string; toTable: string; toColumn: string; reasoning: string }[];
  destructiveChanges: { tableId: string; type: 'drop_table' | 'drop_column' | 'change_type'; description: string }[];
}

// ── Top-level synthesized schema ──────────────────────────────────────────────

export const SynthesizeSchemaInputSchema = z.object({
  prdArtifactId: z.string().min(1),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  existingSchemaId: z.string().optional(),
  feedback: z.string().optional(),
});
export type SynthesizeSchemaInput = z.infer<typeof SynthesizeSchemaInputSchema>;

export interface SynthesizedSchema {
  prdArtifactId: string;
  existingSchemaId?: string;
  databaseDriver: 'postgres' | 'mssql' | 'mongo';

  tables: SynthesizedTable[];

  entityExtraction: EntityExtractionRecord;
  coverageReport: CoverageReport;
  piiDetectionRecord: PiiDetectionRecord;
  indexRecommendations: IndexRecommendation[];
  diff?: SchemaDiff;
}

// ── Audit events ──────────────────────────────────────────────────────────────

export const SCHEMA_SYNTHESIS_AUDIT_EVENTS = {
  SYNTHESIS_STARTED: 'ai.schema_synthesis.synthesis_started',
  SYNTHESIS_COMPLETED: 'ai.schema_synthesis.synthesis_completed',
  TABLE_REGENERATED: 'ai.schema_synthesis.table_regenerated',
  FULL_REGENERATED: 'ai.schema_synthesis.full_regenerated',
  COVERAGE_VALIDATED: 'ai.schema_synthesis.coverage_validated',
  PII_DETECTED: 'ai.schema_synthesis.pii_detected',
  PII_CONFIRMED: 'ai.schema_synthesis.pii_confirmed',
  APPLIED_TO_DESIGNER: 'ai.schema_synthesis.applied_to_designer',
  SUBMITTED_FOR_APPROVAL: 'ai.schema_synthesis.submitted_for_approval',
  APPROVED: 'ai.schema_synthesis.approved',
  REJECTED: 'ai.schema_synthesis.rejected',
} as const;

// ── Permissions ───────────────────────────────────────────────────────────────

export const SCHEMA_SYNTHESIS_PERMISSIONS = {
  CREATE: 'ai.schema_synthesis.create',
  READ: 'ai.schema_synthesis.read',
  REGENERATE: 'ai.schema_synthesis.regenerate',
  APPLY: 'ai.schema_synthesis.apply',
  APPROVE: 'ai.schema_synthesis.approve',
} as const;

export const SCHEMA_SYNTHESIS_DEFAULT_GRANTS: Record<string, string[]> = {
  workspace_owner: Object.values(SCHEMA_SYNTHESIS_PERMISSIONS),
  workspace_admin: Object.values(SCHEMA_SYNTHESIS_PERMISSIONS),
  architect: Object.values(SCHEMA_SYNTHESIS_PERMISSIONS),
  business_analyst: [SCHEMA_SYNTHESIS_PERMISSIONS.READ],
  developer: [SCHEMA_SYNTHESIS_PERMISSIONS.READ, SCHEMA_SYNTHESIS_PERMISSIONS.REGENERATE],
  qa: [SCHEMA_SYNTHESIS_PERMISSIONS.READ],
  reviewer: [SCHEMA_SYNTHESIS_PERMISSIONS.READ],
  viewer: [SCHEMA_SYNTHESIS_PERMISSIONS.READ],
};

// ── Quality signals ───────────────────────────────────────────────────────────

export interface SchemaSynthesisQualitySignals {
  artifactId: string;
  prdEntityCoverageRate: number;
  prdRequirementCoverageRate: number;
  piiDetectionsAccepted: number;
  piiDetectionsRejected: number;
  piiDetectionsModified: number;
  fksAccepted: number;
  fksRejected: number;
  fksAdded: number;
  indexesAccepted: number;
  indexesRejected: number;
  indexesAdded: number;
  totalTableEdits: number;
  totalColumnEdits: number;
  totalRegenerations: number;
  totalTimeToApprovalMinutes: number;
  causedDownstreamIssue: boolean;
  downstreamIssueDescription?: string;
}

// ── Default capability contexts per driver ────────────────────────────────────

export const DEFAULT_CAPABILITY_CONTEXTS: Record<string, CapabilityContext> = {
  postgres: {
    driver: 'postgres',
    capabilities: {
      arrayColumns: true, jsonColumns: true, foreignKeysEnforced: true,
      fullTextSearch: true, geospatial: true, materializedViews: true,
      triggers: true, storedProcedures: true,
    },
    reservedWords: ['order', 'user', 'group', 'table', 'column', 'select', 'from', 'where', 'index', 'primary', 'key', 'default', 'check', 'unique', 'references', 'constraint', 'foreign'],
    identifierMaxLength: 63,
    preferredIndexTypes: ['btree', 'gin', 'gist', 'hash'],
  },
  mssql: {
    driver: 'mssql',
    capabilities: {
      arrayColumns: false, jsonColumns: true, foreignKeysEnforced: true,
      fullTextSearch: true, geospatial: true, materializedViews: false,
      triggers: true, storedProcedures: true,
    },
    reservedWords: ['order', 'user', 'group', 'table', 'column', 'select', 'from', 'where', 'index', 'primary', 'key', 'default', 'check', 'unique', 'references', 'constraint', 'foreign', 'rowguid', 'timestamp'],
    identifierMaxLength: 128,
    preferredIndexTypes: ['clustered', 'nonclustered', 'full-text'],
  },
  mongo: {
    driver: 'mongo',
    capabilities: {
      arrayColumns: true, jsonColumns: true, foreignKeysEnforced: false,
      fullTextSearch: true, geospatial: true, materializedViews: false,
      triggers: false, storedProcedures: false,
    },
    reservedWords: [],
    identifierMaxLength: 120,
    preferredIndexTypes: ['single', 'compound', 'text', '2dsphere'],
  },
};
