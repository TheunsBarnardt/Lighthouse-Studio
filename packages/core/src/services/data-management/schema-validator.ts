import type {
  ColumnDefinition,
  CustomerSchema,
  CustomerTableDefinition,
  DatabaseDriver,
  ForeignKeyDefinition,
  IndexDefinition,
  SchemaChanges,
  ValidationIssue,
  ValidationReport,
} from './schema-model.js';

import { PII_HEURISTIC_NAMES } from './schema-model.js';

// ── Capability sets ────────────────────────────────────────────────────────────
// Declares what each database driver supports. Used by the validator to emit
// warnings/errors when the schema uses a feature the driver can't handle.

interface CapabilitySet {
  arrayColumns: boolean;
  partialIndexes: boolean;
  generatedColumns: boolean;
  rowLevelSecurity: boolean;
  foreignKeyEnforcement: boolean;
  fullTextSearch: boolean;
  jsonColumns: boolean;
  changeStreams: boolean;
}

const DRIVER_CAPABILITIES: Record<DatabaseDriver, CapabilitySet> = {
  postgres: {
    arrayColumns: true,
    partialIndexes: true,
    generatedColumns: true,
    rowLevelSecurity: true,
    foreignKeyEnforcement: true,
    fullTextSearch: true,
    jsonColumns: true,
    changeStreams: true,
  },
  mssql: {
    arrayColumns: false,
    partialIndexes: true, // MSSQL supports filtered indexes
    generatedColumns: true, // computed columns
    rowLevelSecurity: true, // MSSQL has RLS since 2016
    foreignKeyEnforcement: true,
    fullTextSearch: true,
    jsonColumns: true, // JSON functions, not a native column type
    changeStreams: false, // CDC requires separate config
  },
  mongo: {
    arrayColumns: true, // native to Mongo
    partialIndexes: true, // partial indexes supported
    generatedColumns: false,
    rowLevelSecurity: false,
    foreignKeyEnforcement: false, // advisory only
    fullTextSearch: true, // Atlas Search / text indexes
    jsonColumns: true, // documents are JSON
    changeStreams: true,
  },
};

// ── Reserved words ─────────────────────────────────────────────────────────────

const POSTGRES_RESERVED: ReadonlySet<string> = new Set([
  'all',
  'analyse',
  'analyze',
  'and',
  'any',
  'array',
  'as',
  'asc',
  'asymmetric',
  'authorization',
  'binary',
  'both',
  'case',
  'cast',
  'check',
  'collate',
  'column',
  'constraint',
  'create',
  'cross',
  'current_catalog',
  'current_date',
  'current_role',
  'current_schema',
  'current_time',
  'current_timestamp',
  'current_user',
  'default',
  'deferrable',
  'desc',
  'distinct',
  'do',
  'else',
  'end',
  'except',
  'false',
  'fetch',
  'for',
  'foreign',
  'from',
  'full',
  'grant',
  'group',
  'having',
  'ilike',
  'in',
  'initially',
  'inner',
  'intersect',
  'into',
  'is',
  'isnull',
  'join',
  'lateral',
  'leading',
  'left',
  'like',
  'limit',
  'localtime',
  'localtimestamp',
  'natural',
  'not',
  'notnull',
  'null',
  'offset',
  'on',
  'only',
  'or',
  'order',
  'outer',
  'overlaps',
  'placing',
  'primary',
  'references',
  'returning',
  'right',
  'select',
  'session_user',
  'similar',
  'some',
  'symmetric',
  'table',
  'tablesample',
  'then',
  'to',
  'trailing',
  'true',
  'union',
  'unique',
  'user',
  'using',
  'variadic',
  'verbose',
  'when',
  'where',
  'window',
  'with',
]);

const MSSQL_RESERVED: ReadonlySet<string> = new Set([
  'add',
  'all',
  'alter',
  'and',
  'any',
  'as',
  'asc',
  'authorization',
  'backup',
  'begin',
  'between',
  'break',
  'browse',
  'bulk',
  'by',
  'cascade',
  'case',
  'check',
  'checkpoint',
  'close',
  'clustered',
  'coalesce',
  'collate',
  'column',
  'commit',
  'compute',
  'constraint',
  'contains',
  'continue',
  'convert',
  'create',
  'cross',
  'current',
  'cursor',
  'database',
  'dbcc',
  'deallocate',
  'declare',
  'default',
  'delete',
  'deny',
  'desc',
  'distinct',
  'distributed',
  'double',
  'drop',
  'dump',
  'else',
  'end',
  'errlvl',
  'escape',
  'except',
  'exec',
  'execute',
  'exists',
  'exit',
  'external',
  'fetch',
  'file',
  'fillfactor',
  'for',
  'foreign',
  'freetext',
  'from',
  'full',
  'function',
  'goto',
  'grant',
  'group',
  'having',
  'holdlock',
  'identity',
  'identity_insert',
  'identitycol',
  'if',
  'in',
  'index',
  'inner',
  'insert',
  'intersect',
  'into',
  'is',
  'join',
  'key',
  'kill',
  'left',
  'like',
  'lineno',
  'load',
  'merge',
  'national',
  'nocheck',
  'nonclustered',
  'not',
  'null',
  'nullif',
  'of',
  'off',
  'offsets',
  'on',
  'open',
  'option',
  'or',
  'order',
  'outer',
  'over',
  'percent',
  'pivot',
  'plan',
  'precision',
  'primary',
  'print',
  'proc',
  'procedure',
  'public',
  'raiserror',
  'read',
  'references',
  'replication',
  'restore',
  'restrict',
  'return',
  'revert',
  'revoke',
  'right',
  'rollback',
  'rowcount',
  'rowguidcol',
  'rule',
  'save',
  'schema',
  'securityaudit',
  'select',
  'semantickeyphrasetable',
  'session_user',
  'set',
  'setuser',
  'shutdown',
  'some',
  'statistics',
  'system_user',
  'table',
  'tablesample',
  'textsize',
  'then',
  'to',
  'top',
  'tran',
  'transaction',
  'trigger',
  'truncate',
  'try_convert',
  'tsequal',
  'union',
  'unique',
  'unpivot',
  'update',
  'updatetext',
  'use',
  'user',
  'values',
  'varying',
  'view',
  'waitfor',
  'when',
  'where',
  'while',
  'with',
  'within group',
  'writetext',
]);

const MONGO_RESERVED: ReadonlySet<string> = new Set([
  // Mongo collection name restrictions
  'system',
  'admin',
  'local',
  'config',
]);

function getReservedWords(driver: DatabaseDriver): ReadonlySet<string> {
  switch (driver) {
    case 'postgres':
      return POSTGRES_RESERVED;
    case 'mssql':
      return MSSQL_RESERVED;
    case 'mongo':
      return MONGO_RESERVED;
  }
}

// ── Max name lengths ───────────────────────────────────────────────────────────

const MAX_NAME_LENGTHS: Record<DatabaseDriver, number> = {
  postgres: 63,
  mssql: 128,
  mongo: 120, // Mongo collection name limit minus workspace prefix
};

// ── SchemaValidator ────────────────────────────────────────────────────────────

export class SchemaValidator {
  validate(
    schema: CustomerSchema,
    proposed: SchemaChanges,
    driver: DatabaseDriver,
  ): ValidationReport {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const info: ValidationIssue[] = [];

    const caps = DRIVER_CAPABILITIES[driver];
    const maxLen = MAX_NAME_LENGTHS[driver];
    const reserved = getReservedWords(driver);

    // Merge schema + proposed to produce the full candidate schema
    const tables = proposed.tables ?? schema.tables;

    // ── Table-level checks ─────────────────────────────────────────────────────
    const tableNames = new Set<string>();
    const tableIds = new Set<string>();

    for (let ti = 0; ti < tables.length; ti++) {
      const table = tables[ti];
      if (!table) continue;
      const tPath = `tables[${String(ti)}]`;

      // Stable ID present
      if (!table.id) {
        errors.push(
          issue('error', tPath, 'id', 'TABLE_MISSING_ID', 'Table is missing a stable id.'),
        );
      } else if (tableIds.has(table.id)) {
        errors.push(
          issue('error', tPath, 'id', 'TABLE_DUPLICATE_ID', `Duplicate table id '${table.id}'.`),
        );
      } else {
        tableIds.add(table.id);
      }

      // Name format
      this.validateName(table.name, tPath, 'name', maxLen, reserved, driver, errors);

      // Duplicate table names
      if (tableNames.has(table.name)) {
        errors.push(
          issue(
            'error',
            tPath,
            'name',
            'TABLE_DUPLICATE_NAME',
            `Duplicate table name '${table.name}'.`,
          ),
        );
      } else {
        tableNames.add(table.name);
      }

      // Primary key
      this.validatePrimaryKey(table, tPath, errors);

      // Column-level checks
      const colIds = new Set<string>();
      const colNames = new Set<string>();

      for (let ci = 0; ci < table.columns.length; ci++) {
        const col = table.columns[ci];
        if (!col) continue;
        const cPath = `${tPath}.columns[${String(ci)}]`;

        if (!col.id) {
          errors.push(
            issue('error', cPath, 'id', 'COLUMN_MISSING_ID', 'Column is missing a stable id.'),
          );
        } else if (colIds.has(col.id)) {
          errors.push(
            issue('error', cPath, 'id', 'COLUMN_DUPLICATE_ID', `Duplicate column id '${col.id}'.`),
          );
        } else {
          colIds.add(col.id);
        }

        this.validateName(col.name, cPath, 'name', maxLen, reserved, driver, errors);

        if (colNames.has(col.name)) {
          errors.push(
            issue(
              'error',
              cPath,
              'name',
              'COLUMN_DUPLICATE_NAME',
              `Duplicate column name '${col.name}'.`,
            ),
          );
        } else {
          colNames.add(col.name);
        }

        this.validateColumnType(col, cPath, caps, errors, warnings);
        this.validatePiiHeuristic(col, cPath, info);
      }

      // Index-level checks
      for (let ii = 0; ii < table.indexes.length; ii++) {
        const idx = table.indexes[ii];
        if (!idx) continue;
        const iPath = `${tPath}.indexes[${String(ii)}]`;
        this.validateIndex(idx, table, iPath, caps, maxLen, reserved, driver, errors, warnings);
      }

      // Foreign key checks
      for (let fi = 0; fi < table.foreignKeys.length; fi++) {
        const fk = table.foreignKeys[fi];
        if (!fk) continue;
        const fPath = `${tPath}.foreignKeys[${String(fi)}]`;
        this.validateForeignKey(fk, table, tables, fPath, caps, errors, warnings);
      }

      // Capability: change streams
      if (table.changeStream?.enabled && !caps.changeStreams) {
        warnings.push(
          issue(
            'warning',
            tPath,
            'changeStream',
            'CHANGE_STREAM_NOT_SUPPORTED',
            `Change streams are not supported on ${driver}; this setting will be ignored.`,
            `Remove the changeStream config or switch to Postgres or Mongo.`,
          ),
        );
      }

      // Capability: RLS
      if (table.rowLevelSecurity?.enabled && !caps.rowLevelSecurity) {
        errors.push(
          issue(
            'error',
            tPath,
            'rowLevelSecurity',
            'RLS_NOT_SUPPORTED',
            `Row-level security is not supported on ${driver}.`,
            `Remove the rowLevelSecurity config or use Postgres or MSSQL.`,
          ),
        );
      }
    }

    // ── Cross-table FK reference validation ────────────────────────────────────
    // (Verify referenced table IDs actually exist in the proposed schema)
    for (let ti = 0; ti < tables.length; ti++) {
      const tbl = tables[ti];
      if (!tbl) continue;
      for (let fi = 0; fi < tbl.foreignKeys.length; fi++) {
        const fk = tbl.foreignKeys[fi];
        if (!fk) continue;
        const fPath = `tables[${String(ti)}].foreignKeys[${String(fi)}]`;
        if (fk.referencedTableId && !tableIds.has(fk.referencedTableId)) {
          errors.push(
            issue(
              'error',
              fPath,
              'referencedTableId',
              'FK_UNKNOWN_TABLE',
              `Foreign key references unknown table id '${fk.referencedTableId}'.`,
            ),
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private validateName(
    name: string,
    path: string,
    field: string,
    maxLen: number,
    reserved: ReadonlySet<string>,
    driver: DatabaseDriver,
    errors: ValidationIssue[],
  ): void {
    if (!name) {
      errors.push(issue('error', path, field, 'NAME_EMPTY', 'Name must not be empty.'));
      return;
    }

    // snake_case enforcement
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      errors.push(
        issue(
          'error',
          path,
          field,
          'NAME_NOT_SNAKE_CASE',
          `Name '${name}' must be lowercase snake_case (letters, digits, underscores; start with a letter).`,
          `Rename to '${toSnakeCase(name)}'.`,
        ),
      );
    }

    // Length
    if (name.length > maxLen) {
      errors.push(
        issue(
          'error',
          path,
          field,
          'NAME_TOO_LONG',
          `Name '${name}' exceeds the ${driver} maximum of ${String(maxLen)} characters.`,
        ),
      );
    }

    // Reserved words
    if (reserved.has(name.toLowerCase())) {
      errors.push(
        issue(
          'error',
          path,
          field,
          'NAME_RESERVED_WORD',
          `'${name}' is a reserved word in ${driver} and cannot be used as an identifier.`,
          `Prefix the name, e.g. '${name}_`,
        ),
      );
    }

    // Platform-reserved prefixes
    if (name.startsWith('_platform_') || name.startsWith('cust_')) {
      errors.push(
        issue(
          'error',
          path,
          field,
          'NAME_RESERVED_PREFIX',
          `Names starting with '_platform_' or 'cust_' are reserved for platform internals.`,
        ),
      );
    }
  }

  private validatePrimaryKey(
    table: CustomerTableDefinition,
    tPath: string,
    errors: ValidationIssue[],
  ): void {
    const pk = table.primaryKey;
    const colIds = new Set(table.columns.map((c) => c.id));

    if (pk.kind === 'single') {
      if (!colIds.has(pk.columnId)) {
        errors.push(
          issue(
            'error',
            tPath,
            'primaryKey',
            'PK_UNKNOWN_COLUMN',
            `Primary key references unknown column id '${pk.columnId}'.`,
          ),
        );
      } else {
        const col = table.columns.find((c) => c.id === pk.columnId);
        if (col?.nullable) {
          errors.push(
            issue(
              'error',
              tPath,
              'primaryKey',
              'PK_NULLABLE',
              `Primary key column '${col.name}' must be NOT NULL.`,
            ),
          );
        }
      }
    } else {
      for (const colId of pk.columnIds) {
        if (!colIds.has(colId)) {
          errors.push(
            issue(
              'error',
              tPath,
              'primaryKey',
              'PK_UNKNOWN_COLUMN',
              `Composite primary key references unknown column id '${colId}'.`,
            ),
          );
        }
      }
      if (pk.columnIds.length === 0) {
        errors.push(
          issue(
            'error',
            tPath,
            'primaryKey',
            'PK_EMPTY_COMPOSITE',
            `Composite primary key must include at least one column.`,
          ),
        );
      }
    }
  }

  private validateColumnType(
    col: ColumnDefinition,
    cPath: string,
    caps: CapabilitySet,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    const type = col.type;

    if (type.kind === 'array' && !caps.arrayColumns) {
      errors.push(
        issue(
          'error',
          cPath,
          'type',
          'TYPE_ARRAY_NOT_SUPPORTED',
          `Array columns are not supported on this database.`,
          `Use a JSON column or a separate child table instead.`,
        ),
      );
    }

    if (type.kind === 'json' && !caps.jsonColumns) {
      warnings.push(
        issue(
          'warning',
          cPath,
          'type',
          'TYPE_JSON_LIMITED',
          `JSON column support is limited on this database; ensure your queries use supported JSON functions.`,
        ),
      );
    }

    if (col.generated && !caps.generatedColumns) {
      errors.push(
        issue(
          'error',
          cPath,
          'generated',
          'GENERATED_NOT_SUPPORTED',
          `Generated (computed) columns are not supported on this database.`,
        ),
      );
    }
  }

  private validatePiiHeuristic(
    col: ColumnDefinition,
    cPath: string,
    info: ValidationIssue[],
  ): void {
    if (col.isPii !== undefined) return; // user already classified it

    const lower = col.name.toLowerCase();
    if (PII_HEURISTIC_NAMES.has(lower)) {
      info.push(
        issue(
          'info',
          cPath,
          'name',
          'PII_HEURISTIC_MATCH',
          `Column name '${col.name}' looks like it may contain personal data (PII). Please confirm whether this column contains PII.`,
          `Set isPii and piiCategory on this column to classify it.`,
        ),
      );
    }
  }

  private validateIndex(
    idx: IndexDefinition,
    table: CustomerTableDefinition,
    iPath: string,
    caps: CapabilitySet,
    maxLen: number,
    reserved: ReadonlySet<string>,
    driver: DatabaseDriver,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    this.validateName(idx.name, iPath, 'name', maxLen, reserved, driver, errors);

    const colIds = new Set(table.columns.map((c) => c.id));
    for (const ic of idx.columns) {
      if (!colIds.has(ic.columnId)) {
        errors.push(
          issue(
            'error',
            iPath,
            'columns',
            'INDEX_UNKNOWN_COLUMN',
            `Index references unknown column id '${ic.columnId}'.`,
          ),
        );
      }
    }

    if (idx.columns.length === 0) {
      errors.push(
        issue('error', iPath, 'columns', 'INDEX_EMPTY', `Index must include at least one column.`),
      );
    }

    if (idx.partial && !caps.partialIndexes) {
      warnings.push(
        issue(
          'warning',
          iPath,
          'partial',
          'PARTIAL_INDEX_NOT_SUPPORTED',
          `Partial/filtered indexes are not supported on this database; the index will be created without the predicate.`,
        ),
      );
    }
  }

  private validateForeignKey(
    fk: ForeignKeyDefinition,
    table: CustomerTableDefinition,
    allTables: CustomerTableDefinition[],
    fPath: string,
    caps: CapabilitySet,
    errors: ValidationIssue[],
    warnings: ValidationIssue[],
  ): void {
    const colIds = new Set(table.columns.map((c) => c.id));

    for (const colId of fk.columns) {
      if (!colIds.has(colId)) {
        errors.push(
          issue(
            'error',
            fPath,
            'columns',
            'FK_UNKNOWN_SOURCE_COLUMN',
            `Foreign key references unknown source column id '${colId}'.`,
          ),
        );
      }
    }

    const refTable = allTables.find((t) => t.id === fk.referencedTableId);
    if (refTable) {
      const refColIds = new Set(refTable.columns.map((c) => c.id));
      for (const colId of fk.referencedColumns) {
        if (!refColIds.has(colId)) {
          errors.push(
            issue(
              'error',
              fPath,
              'referencedColumns',
              'FK_UNKNOWN_REF_COLUMN',
              `Foreign key references unknown column id '${colId}' in table '${refTable.name}'.`,
            ),
          );
        }
      }

      if (fk.columns.length !== fk.referencedColumns.length) {
        errors.push(
          issue(
            'error',
            fPath,
            'columns',
            'FK_COLUMN_COUNT_MISMATCH',
            `Foreign key must have the same number of source and referenced columns.`,
          ),
        );
      }
    }

    if (!caps.foreignKeyEnforcement) {
      warnings.push(
        issue(
          'warning',
          fPath,
          undefined,
          'FK_ADVISORY_ONLY',
          `Foreign keys are advisory on MongoDB; the database will NOT enforce referential integrity.`,
          `The platform validates FK references at write time (enabled in a later objective). Store the relationship and proceed with awareness of this limitation.`,
        ),
      );
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function issue(
  severity: 'error' | 'warning' | 'info',
  path: string,
  field: string | undefined,
  code: string,
  message: string,
  suggestion?: string,
): ValidationIssue {
  return {
    path,
    ...(field !== undefined ? { field } : {}),
    code,
    severity,
    message,
    ...(suggestion !== undefined ? { suggestion } : {}),
  };
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_/, '');
}
