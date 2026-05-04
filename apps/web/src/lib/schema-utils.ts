import type {
  ColumnDefinition,
  CustomerSchema,
  DatabaseDriver,
  DriverCapabilities,
  ForeignKeyDefinition,
  IndexDefinition,
  NormalizedType,
  TableDefinition,
} from './types';

import { DRIVER_CAPABILITIES } from './types';

// ── Table operations ─────────────────────────────────────────────────────────

export function findTableById(schema: CustomerSchema, id: string): TableDefinition | undefined {
  return schema.tables.find((t) => t.id === id);
}

export function findTableByName(schema: CustomerSchema, name: string): TableDefinition | undefined {
  return schema.tables.find((t) => t.name === name);
}

export function addTable(schema: CustomerSchema, table: TableDefinition): CustomerSchema {
  return { ...schema, tables: [...schema.tables, table] };
}

export function removeTable(schema: CustomerSchema, tableId: string): CustomerSchema {
  return {
    ...schema,
    tables: schema.tables
      .filter((t) => t.id !== tableId)
      .map((t) => ({
        ...t,
        foreignKeys: t.foreignKeys.filter((fk) => fk.referencedTableId !== tableId),
      })),
  };
}

export function updateTable(
  schema: CustomerSchema,
  tableId: string,
  changes: Partial<TableDefinition>,
): CustomerSchema {
  return {
    ...schema,
    tables: schema.tables.map((t) => (t.id === tableId ? { ...t, ...changes } : t)),
  };
}

// ── Column operations ─────────────────────────────────────────────────────────

export function addColumn(
  schema: CustomerSchema,
  tableId: string,
  column: ColumnDefinition,
): CustomerSchema {
  return updateTable(schema, tableId, {
    columns: [...(findTableById(schema, tableId)?.columns ?? []), column],
  });
}

export function updateColumn(
  schema: CustomerSchema,
  tableId: string,
  columnId: string,
  changes: Partial<ColumnDefinition>,
): CustomerSchema {
  const table = findTableById(schema, tableId);
  if (!table) return schema;
  return updateTable(schema, tableId, {
    columns: table.columns.map((c) => (c.id === columnId ? { ...c, ...changes } : c)),
  });
}

export function removeColumn(
  schema: CustomerSchema,
  tableId: string,
  columnId: string,
): CustomerSchema {
  const table = findTableById(schema, tableId);
  if (!table) return schema;
  return updateTable(schema, tableId, {
    columns: table.columns.filter((c) => c.id !== columnId),
    primaryKey:
      table.primaryKey.kind === 'single' && table.primaryKey.columnId === columnId
        ? { kind: 'single', columnId: '' }
        : table.primaryKey.kind === 'composite'
          ? {
              kind: 'composite',
              columnIds: table.primaryKey.columnIds.filter((id) => id !== columnId),
            }
          : table.primaryKey,
    indexes: table.indexes
      .map((idx) => ({ ...idx, columnIds: idx.columnIds.filter((id) => id !== columnId) }))
      .filter((idx) => idx.columnIds.length > 0),
    foreignKeys: table.foreignKeys.filter((fk) => !fk.columnIds.includes(columnId)),
  });
}

// ── Relation (FK) operations ──────────────────────────────────────────────────

export function addForeignKey(
  schema: CustomerSchema,
  tableId: string,
  fk: ForeignKeyDefinition,
): CustomerSchema {
  const table = findTableById(schema, tableId);
  if (!table) return schema;
  return updateTable(schema, tableId, {
    foreignKeys: [...table.foreignKeys, fk],
  });
}

export function removeForeignKey(
  schema: CustomerSchema,
  tableId: string,
  fkId: string,
): CustomerSchema {
  const table = findTableById(schema, tableId);
  if (!table) return schema;
  return updateTable(schema, tableId, {
    foreignKeys: table.foreignKeys.filter((fk) => fk.id !== fkId),
  });
}

// ── Index operations ──────────────────────────────────────────────────────────

export function addIndex(
  schema: CustomerSchema,
  tableId: string,
  index: IndexDefinition,
): CustomerSchema {
  const table = findTableById(schema, tableId);
  if (!table) return schema;
  return updateTable(schema, tableId, {
    indexes: [...table.indexes, index],
  });
}

export function removeIndex(
  schema: CustomerSchema,
  tableId: string,
  indexId: string,
): CustomerSchema {
  const table = findTableById(schema, tableId);
  if (!table) return schema;
  return updateTable(schema, tableId, {
    indexes: table.indexes.filter((idx) => idx.id !== indexId),
  });
}

// ── Capability checks ─────────────────────────────────────────────────────────

export function getCapabilities(driver: DatabaseDriver): DriverCapabilities {
  return DRIVER_CAPABILITIES[driver];
}

export function isTypeSupported(type: NormalizedType, driver: DatabaseDriver): boolean {
  const caps = DRIVER_CAPABILITIES[driver];
  if (type.kind === 'array' && !caps.arrays) return false;
  return true;
}

export interface CapabilityWarning {
  tableId: string;
  columnId?: string;
  foreignKeyId?: string;
  capability: keyof DriverCapabilities;
  message: string;
}

export function getCapabilityWarnings(schema: CustomerSchema): CapabilityWarning[] {
  const warnings: CapabilityWarning[] = [];
  const caps = DRIVER_CAPABILITIES[schema.databaseDriver];

  for (const table of schema.tables) {
    // Array columns
    if (!caps.arrays) {
      for (const col of table.columns) {
        if (col.type.kind === 'array') {
          warnings.push({
            tableId: table.id,
            columnId: col.id,
            capability: 'arrays',
            message: `Array columns are not supported on ${schema.databaseDriver.toUpperCase()}. Column "${col.name}" uses an array type.`,
          });
        }
      }
    }

    // Check constraints
    if (!caps.checkConstraints && table.constraints.some((c) => c.kind === 'check')) {
      warnings.push({
        tableId: table.id,
        capability: 'checkConstraints',
        message: `Check constraints are not supported on ${schema.databaseDriver.toUpperCase()}. Remove check constraints from "${table.name}".`,
      });
    }

    // Row-level security
    if (!caps.rowLevelSecurity && table.rowLevelSecurity?.enabled) {
      warnings.push({
        tableId: table.id,
        capability: 'rowLevelSecurity',
        message: `Row-level security is not supported on ${schema.databaseDriver.toUpperCase()}. Disable RLS on "${table.name}".`,
      });
    }

    // Foreign keys (advisory on Mongo)
    if (!caps.foreignKeyEnforcement && table.foreignKeys.length > 0) {
      for (const fk of table.foreignKeys) {
        warnings.push({
          tableId: table.id,
          foreignKeyId: fk.id,
          capability: 'foreignKeyEnforcement',
          message: `Foreign keys are advisory only on MongoDB. Referential integrity is not enforced for "${fk.name}".`,
        });
      }
    }
  }

  return warnings;
}

// ── PII heuristic ─────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  'email',
  'phone',
  'address',
  'ssn',
  'credit_card',
  'password',
  'api_key',
  'token',
  'first_name',
  'last_name',
  'birth_date',
  'ip_address',
  'latitude',
  'longitude',
  'passport',
  'driver_license',
  'tax_id',
  'bank_account',
  'social_security',
];

export function detectPiiColumns(table: TableDefinition): string[] {
  return table.columns
    .filter((col) => {
      if (col.isPii !== undefined) return false; // already classified
      return PII_PATTERNS.some((pattern) => col.name.toLowerCase().includes(pattern));
    })
    .map((col) => col.id);
}

// ── New entity ID generation ──────────────────────────────────────────────────

export function generateId(): string {
  return crypto.randomUUID();
}

export function newColumn(name = '', tableId: string): ColumnDefinition {
  void tableId;
  return {
    id: generateId(),
    name,
    type: { kind: 'text' },
    nullable: true,
  };
}

export function newTable(schemaId: string): TableDefinition {
  void schemaId;
  const id = generateId();
  const pkColId = generateId();
  return {
    id,
    name: 'new_table',
    columns: [
      { id: pkColId, name: 'id', type: { kind: 'uuid' }, nullable: false },
      {
        id: generateId(),
        name: 'created_at',
        type: { kind: 'timestamp_tz' },
        nullable: false,
        defaultValue: { kind: 'function', name: 'now()' },
      },
    ],
    primaryKey: { kind: 'single', columnId: pkColId },
    indexes: [],
    foreignKeys: [],
    constraints: [],
  };
}

// ── JSON schema round-trip ────────────────────────────────────────────────────

export function schemaToJson(schema: CustomerSchema): string {
  const exportable = {
    ...schema,
    metadata: {
      ...schema.metadata,
    },
  };
  return JSON.stringify(exportable, null, 2);
}

export function normalizedTypeName(type: NormalizedType): string {
  switch (type.kind) {
    case 'string':
      return type.length ? `varchar(${String(type.length)})` : 'varchar';
    case 'text':
      return 'text';
    case 'integer':
      return 'integer';
    case 'bigint':
      return 'bigint';
    case 'decimal':
      return `decimal(${String(type.precision)},${String(type.scale)})`;
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'date';
    case 'timestamp':
      return 'timestamp';
    case 'timestamp_tz':
      return 'timestamptz';
    case 'uuid':
      return 'uuid';
    case 'binary':
      return 'binary';
    case 'json':
      return 'json';
    case 'array':
      return `${normalizedTypeName(type.elementType)}[]`;
    default:
      return 'unknown';
  }
}
