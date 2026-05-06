// ── Domain types for the Data Browser ────────────────────────────────────────

export type ImportJobStatus =
  | 'pending'
  | 'validating'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExportJobStatus = 'pending' | 'exporting' | 'completed' | 'failed';

export type ImportOnError = 'skip' | 'fail';

export type ExportFormat = 'csv' | 'json';

export type ExportScope = 'filtered' | 'all';

// ── Saved View ────────────────────────────────────────────────────────────────

export interface DataBrowserView {
  id: string;
  version: number;
  workspaceId: string;
  schemaId: string;
  tableId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  filterConfig: Record<string, unknown> | null;
  sortConfig: SortConfig[] | null;
  visibleColumns: string[] | null;
  shared: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface SortConfig {
  columnId: string;
  direction: 'asc' | 'desc';
}

// ── Import Job ────────────────────────────────────────────────────────────────

export interface ImportJob {
  id: string;
  version: number;
  workspaceId: string;
  schemaId: string;
  tableId: string;
  initiatedByUserId: string;
  sourceFileId: string;
  columnMapping: Record<string, string>;
  onError: ImportOnError;
  status: ImportJobStatus;
  totalRows: number | null;
  importedRows: number;
  skippedRows: number;
  errorFileId: string | null;
  errorSummary: ImportErrorSummary | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface ImportErrorSummary {
  totalErrors: number;
  byType: Record<string, number>;
  sample: Array<{ row: number; column: string; message: string }>;
}

// ── Export Job ────────────────────────────────────────────────────────────────

export interface ExportJob {
  id: string;
  version: number;
  workspaceId: string;
  schemaId: string;
  tableId: string;
  initiatedByUserId: string;
  filterConfig: Record<string, unknown> | null;
  sortConfig: SortConfig[] | null;
  format: ExportFormat;
  scope: ExportScope;
  status: ExportJobStatus;
  totalRows: number | null;
  exportedRows: number;
  outputFileId: string | null;
  signedUrl: string | null;
  signedUrlExpiresAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
  updatedBy: string | null;
}

// ── FK lookup ─────────────────────────────────────────────────────────────────

export interface FkLookupRequest {
  /** The column in the current table (e.g. "author_id"). */
  columnId: string;
  /** The table being referenced. */
  targetTableId: string;
  /** The IDs to resolve. */
  ids: string[];
}

export interface FkLookupResult {
  columnId: string;
  targetTableId: string;
  /** Map from ID → display value. Missing entries = not found. */
  resolved: Record<string, string>;
}

// ── Input / Output types ──────────────────────────────────────────────────────

export interface ListViewsOptions {
  workspaceId: string;
  schemaId: string;
  tableId: string;
  includeShared?: boolean;
  limit: number;
  offset: number;
}

export interface CreateViewInput {
  workspaceId: string;
  schemaId: string;
  tableId: string;
  name: string;
  description?: string;
  filterConfig?: Record<string, unknown>;
  sortConfig?: SortConfig[];
  visibleColumns?: string[];
  shared?: boolean;
}

export interface UpdateViewInput {
  id: string;
  version: number;
  workspaceId: string;
  name?: string;
  description?: string;
  filterConfig?: Record<string, unknown> | null;
  sortConfig?: SortConfig[] | null;
  visibleColumns?: string[] | null;
  shared?: boolean;
}

export interface StartImportInput {
  workspaceId: string;
  schemaId: string;
  tableId: string;
  sourceFileId: string;
  columnMapping: Record<string, string>;
  onError?: ImportOnError;
}

export interface StartExportInput {
  workspaceId: string;
  schemaId: string;
  tableId: string;
  filterConfig?: Record<string, unknown>;
  sortConfig?: SortConfig[];
  format?: ExportFormat;
  scope?: ExportScope;
}
