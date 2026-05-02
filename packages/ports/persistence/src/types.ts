import { z } from 'zod';

// ---- Platform-level column types ----

export type PlatformColumnType =
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
  | { kind: 'array'; elementType: PlatformColumnType };

// ---- Filter AST ----

export type FieldOperator<V> =
  | { _eq: V }
  | { _neq: V }
  | { _in: V[] }
  | { _nin: V[] }
  | { _lt: V }
  | { _lte: V }
  | { _gt: V }
  | { _gte: V }
  | { _contains: string }
  | { _icontains: string }
  | { _starts_with: string }
  | { _ends_with: string }
  | { _is_null: boolean };

export type FieldFilter<T> = {
  [K in keyof T]?: T[K] | FieldOperator<T[K]>;
};

export type Filter<T> =
  | { _and: Filter<T>[] }
  | { _or: Filter<T>[] }
  | { _not: Filter<T> }
  | FieldFilter<T>;

// ---- Sorting ----

export type SortDirection = 'asc' | 'desc';

export type Sort<T> = {
  [K in keyof T]?: SortDirection;
};

// ---- Pagination ----

export interface Page {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---- Schema model ----

export interface ColumnDefinition {
  name: string;
  type: PlatformColumnType;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isUnique: boolean;
  comment?: string;
}

export interface IndexDefinition {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPartial: boolean;
  predicate?: string;
  method?: 'btree' | 'hash' | 'gist' | 'gin';
}

export interface ForeignKeyDefinition {
  name: string;
  columns: string[];
  referencedSchema?: string;
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
  onUpdate?: 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
}

export interface ConstraintDefinition {
  name: string;
  type: 'CHECK' | 'UNIQUE' | 'PRIMARY_KEY' | 'FOREIGN_KEY';
  expression?: string;
  columns?: string[];
}

export interface TableDefinition {
  schema?: string;
  name: string;
  columns: ColumnDefinition[];
  indexes: IndexDefinition[];
  foreignKeys: ForeignKeyDefinition[];
  constraints: ConstraintDefinition[];
  comment?: string;
}

export interface SchemaInfo {
  name: string;
  owner?: string;
}

export interface TableInfo {
  schema?: string;
  name: string;
  type: 'table' | 'view';
  rowCount?: number;
  comment?: string;
}

export interface IndexInfo {
  name: string;
  schema?: string;
  table: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface ForeignKeyInfo {
  name: string;
  schema?: string;
  table: string;
  columns: string[];
  referencedSchema?: string;
  referencedTable: string;
  referencedColumns: string[];
}

export interface ConstraintInfo {
  name: string;
  schema?: string;
  table: string;
  type: 'CHECK' | 'UNIQUE' | 'PRIMARY_KEY' | 'FOREIGN_KEY';
  expression?: string;
}

export interface DdlStatement {
  sql: string;
  reverseSql?: string;
}

export interface MigrationRecord {
  id: string;
  name: string;
  appliedAt: Date;
  checksum: string;
}

// ---- Schema features ----

export type SchemaFeature =
  | 'schemas'
  | 'foreign_keys'
  | 'check_constraints'
  | 'computed_columns'
  | 'json_columns'
  | 'array_columns'
  | 'partial_indexes'
  | 'unique_indexes'
  | 'spatial_indexes'
  | 'transactions'
  | 'change_streams';

// ---- Zod schemas for validation ----

export const PageSchema = z.object({
  limit: z.number().int().min(1).max(1000),
  offset: z.number().int().min(0),
});

export const SortDirectionSchema = z.enum(['asc', 'desc']);
