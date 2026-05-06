// ── Shared UI types for the Data Browser ─────────────────────────────────────

export interface ColumnDefinition {
  id: string;
  name: string;
  type: ColumnType;
  required: boolean;
  nullable: boolean;
  maxLength?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey: boolean;
  isPii: boolean;
  foreignKey?: ForeignKeyDef;
  defaultValue?: unknown;
}

export type ColumnType =
  | 'string'
  | 'text'
  | 'number'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'array'
  | 'uuid'
  | 'file'
  | 'image'
  | 'video'
  | 'fk';

export interface ForeignKeyDef {
  targetTableId: string;
  targetTableName: string;
  targetColumnId: string;
  displayColumn?: string;
}

export interface RowPermissions {
  canEdit: boolean;
  canDelete: boolean;
  redactedFields: Set<string>;
}

export interface RowContext {
  id: string;
  version: number;
  permissions: RowPermissions;
  isEditingLocally: boolean;
  hasPendingRealtime: boolean;
}

export interface CellProps<TValue = unknown> {
  value: TValue;
  isEditing: boolean;
  canEdit: boolean;
  isRedacted: boolean;
  onStartEdit: () => void;
  onChange: (value: TValue) => void;
  onCommit: () => Promise<void>;
  onCancel: () => void;
  columnDef: ColumnDefinition;
  rowContext: RowContext;
}

export interface SortConfig {
  columnId: string;
  direction: 'asc' | 'desc';
}

export interface FilterNode {
  type: 'condition' | 'group';
  field?: string;
  operator?: string;
  value?: unknown;
  logic?: 'and' | 'or';
  children?: FilterNode[];
}

export interface DataBrowserView {
  id: string;
  name: string;
  filterConfig: FilterNode | null;
  sortConfig: SortConfig[];
  visibleColumns: string[] | null;
  shared: boolean;
}

export interface ConflictInfo {
  rowId: string;
  columnId: string;
  localValue: unknown;
  serverValue: unknown;
  serverVersion: number;
  changedBy?: string;
  changedAt?: Date;
}

export type BulkAction = 'delete' | 'archive' | 'restore' | 'hard_delete';
