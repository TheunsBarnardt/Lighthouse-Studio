'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  BulkAction,
  ColumnDefinition,
  ConflictInfo,
  DataBrowserView,
  FilterNode,
  SortConfig,
} from './types.js';

import { BulkActionDialog } from './dialogs/BulkActionDialog.js';
import { ExportDialog } from './dialogs/ExportDialog.js';
import { FilterDialog } from './dialogs/FilterDialog.js';
import { ImportDialog } from './dialogs/ImportDialog.js';
import { RowDeleteConfirmDialog } from './dialogs/RowDeleteConfirmDialog.js';
import { SaveViewDialog } from './dialogs/SaveViewDialog.js';
import { SchemaQuickReferenceDialog } from './dialogs/SchemaQuickReferenceDialog.js';
import { Grid } from './panels/Grid.js';
import { RowDetailPanel } from './panels/RowDetailPanel.js';
import { StatusBar } from './panels/StatusBar.js';
import { TablePicker } from './panels/TablePicker.js';
import { Toolbar } from './panels/Toolbar.js';

// eslint-disable-next-line no-restricted-syntax -- client-side: must use NEXT_PUBLIC_* directly
const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 500;

interface TableInfo {
  id: string;
  name: string;
  rowCount?: number;
}

type DialogKind =
  | 'filter'
  | 'export'
  | 'import'
  | 'save_view'
  | 'schema_ref'
  | { kind: 'bulk'; action: BulkAction }
  | { kind: 'delete_row'; rowId: string };

export default function DataBrowserPage() {
  const params = useParams<{ schemaSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const schemaSlug = params.schemaSlug;

  // ── State ──────────────────────────────────────────────────────────────────

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    searchParams.get('table') ?? null,
  );
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [filter, setFilter] = useState<FilterNode | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = useState<Record<string, unknown> | null>(null);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [savedViews, setSavedViews] = useState<DataBrowserView[]>([]);
  const [activeView, setActiveView] = useState<DataBrowserView | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [highlightedRowIds] = useState<Set<string>>(new Set());
  const [pendingRealtimeRowIds] = useState<Set<string>>(new Set());
  const [realtimeEventsOutsideView] = useState(0);
  const [fkLabels, setFkLabels] = useState<Record<string, Record<string, string>>>({});

  const lastAnchorRef = useRef<string | null>(null);

  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const selectedTable = tables.find((t) => t.id === selectedTableId);

  // ── URL sync ───────────────────────────────────────────────────────────────

  const updateUrl = useCallback(
    (tableId: string | null, viewId: string | null) => {
      const sp = new URLSearchParams();
      if (tableId) sp.set('table', tableId);
      if (viewId) sp.set('view', viewId);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router],
  );

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchTables();
  }, [schemaSlug]);

  useEffect(() => {
    if (selectedTableId) {
      setPage(1);
      void fetchColumns();
      void fetchRows(1);
    }
  }, [selectedTableId, filter, sortConfig, pageSize]);

  useEffect(() => {
    if (selectedTableId) void fetchRows(page);
  }, [page]);

  const fetchTables = async () => {
    setTablesLoading(true);
    try {
      const res = await fetch(`/api/v1/data/${DEFAULT_WORKSPACE_ID}/schemas/${schemaSlug}/tables`);
      if (res.ok) {
        const data = (await res.json()) as { tables: TableInfo[] };
        setTables(data.tables);
        if (!selectedTableId && data.tables[0]) {
          setSelectedTableId(data.tables[0].id);
        }
      }
    } finally {
      setTablesLoading(false);
    }
  };

  const fetchColumns = async () => {
    if (!selectedTableId) return;
    try {
      const res = await fetch(
        `/api/v1/data/${DEFAULT_WORKSPACE_ID}/schemas/${schemaSlug}/tables/${selectedTableId}/columns`,
      );
      if (res.ok) {
        const data = (await res.json()) as { columns: ColumnDefinition[] };
        setColumns(data.columns);
      }
    } catch {
      // silently ignore; columns stay empty
    }
  };

  const fetchRows = async (p: number) => {
    if (!selectedTableId) return;
    setLoading(true);
    try {
      const sp = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSize),
      });
      if (filter) sp.set('filter', JSON.stringify(filter));
      if (sortConfig.length > 0) sp.set('sort', JSON.stringify(sortConfig));

      const res = await fetch(
        `/api/v1/data/${DEFAULT_WORKSPACE_ID}/${schemaSlug}/${selectedTableId}?${sp.toString()}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {
          rows: Record<string, unknown>[];
          total: number;
        };
        setRows(data.rows);
        setTotalRows(data.total);
        // Batch FK lookups for visible rows
        void resolveFkLabels(data.rows);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── FK resolution ──────────────────────────────────────────────────────────

  const resolveFkLabels = async (newRows: Record<string, unknown>[]) => {
    const fkCols = columns.filter((c) => c.type === 'fk' && c.foreignKey);
    if (fkCols.length === 0) return;

    const updates: Record<string, Record<string, string>> = {};
    await Promise.all(
      fkCols.map(async (col) => {
        const ids = [
          ...new Set(
            newRows
              .map((r) => {
                const v = r[col.id];
                return v !== null && v !== undefined ? String(v as string | number | boolean) : '';
              })
              .filter(Boolean),
          ),
        ];
        if (ids.length === 0) return;

        const existing = fkLabels[col.id] ?? {};
        const missing = ids.filter((id) => !(id in existing));
        if (missing.length === 0) return;

        try {
          const res = await fetch(
            `/api/v1/data/${DEFAULT_WORKSPACE_ID}/schemas/${schemaSlug}/fk-resolve`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                columnId: col.id,
                targetTableId: col.foreignKey?.targetTableId ?? '',
                ids: missing,
              }),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as { resolved: Record<string, string> };
            updates[col.id] = { ...existing, ...data.resolved };
          }
        } catch {
          // ignore; cells fall back to raw ID
        }
      }),
    );

    if (Object.keys(updates).length > 0) {
      setFkLabels((prev) => ({ ...prev, ...updates }));
    }
  };

  // ── Selection ──────────────────────────────────────────────────────────────

  const handleRowSelect = (rowId: string, mode: 'single' | 'shift' | 'ctrl') => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (mode === 'ctrl') {
        if (next.has(rowId)) next.delete(rowId);
        else next.add(rowId);
      } else if (mode === 'shift' && lastAnchorRef.current) {
        const anchor = lastAnchorRef.current;
        const anchorIdx = rows.findIndex((r) => String(r['id']) === anchor);
        const targetIdx = rows.findIndex((r) => String(r['id']) === rowId);
        if (anchorIdx !== -1 && targetIdx !== -1) {
          const [from, to] =
            anchorIdx < targetIdx ? [anchorIdx, targetIdx] : [targetIdx, anchorIdx];
          for (let i = from; i <= to; i++) {
            const r = rows[i];
            if (r) {
              const rid = r['id'];
              next.add(rid !== null && rid !== undefined ? String(rid as string | number) : '');
            }
          }
        }
      } else {
        next.clear();
        next.add(rowId);
        lastAnchorRef.current = rowId;
      }
      return next;
    });
  };

  // ── Cell save with optimistic update ──────────────────────────────────────

  const handleCellSave = async (
    rowId: string,
    columnId: string,
    value: unknown,
    version: number,
  ): Promise<{ conflict?: ConflictInfo }> => {
    // Optimistic: update local state immediately
    setRows((prev) =>
      prev.map((r) => (String(r['id']) === rowId ? { ...r, [columnId]: value } : r)),
    );

    try {
      const tableId = selectedTableId ?? '';
      const res = await fetch(
        `/api/v1/data/${DEFAULT_WORKSPACE_ID}/${schemaSlug}/${tableId}/${rowId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [columnId]: value, _version: version }),
        },
      );

      if (res.status === 409) {
        // Conflict — fetch server version
        const serverRes = await fetch(
          `/api/v1/data/${DEFAULT_WORKSPACE_ID}/${schemaSlug}/${tableId}/${rowId}`,
        );
        const serverRow = serverRes.ok ? ((await serverRes.json()) as Record<string, unknown>) : {};
        const serverValue = serverRow[columnId];
        const serverVersion = Number(serverRow['_version'] ?? version + 1);

        // Revert optimistic update
        setRows((prev) =>
          prev.map((r) => (String(r['id']) === rowId ? { ...r, [columnId]: serverValue } : r)),
        );

        const conflictInfo: ConflictInfo = {
          rowId,
          columnId,
          localValue: value,
          serverValue,
          serverVersion,
          ...(serverRow['_updatedBy'] !== undefined && {
            changedBy: serverRow['_updatedBy'] as string,
          }),
          ...(serverRow['_updatedAt'] !== undefined && {
            changedAt: new Date(serverRow['_updatedAt'] as string),
          }),
        };
        return { conflict: conflictInfo };
      }

      if (!res.ok) {
        // Network error — revert
        await fetchRows(page);
      }
    } catch {
      // Revert on error
      await fetchRows(page);
    }

    return {};
  };

  // ── Sort ──────────────────────────────────────────────────────────────────

  const handleSortChange = (col: ColumnDefinition, multi: boolean) => {
    setSortConfig((prev) => {
      const existing = prev.find((s) => s.columnId === col.id);
      if (multi) {
        if (!existing) return [...prev, { columnId: col.id, direction: 'asc' }];
        if (existing.direction === 'asc') {
          return prev.map((s) => (s.columnId === col.id ? { ...s, direction: 'desc' } : s));
        }
        return prev.filter((s) => s.columnId !== col.id);
      } else {
        if (!existing || existing.direction === 'desc')
          return [{ columnId: col.id, direction: 'asc' }];
        return [{ columnId: col.id, direction: 'desc' }];
      }
    });
  };

  // ── Realtime placeholder (wired to Objective 14 in a real deployment) ──────

  useEffect(() => {
    if (!realtimeEnabled || !selectedTableId) return;
    // In a real deployment this subscribes via the WebSocket/SSE realtime client.
    // The subscription is cleaned up on unmount / filter change / table change.
    return () => {
      // cleanup
    };
  }, [realtimeEnabled, selectedTableId, filter]);

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const handleBulkAction = async (action: BulkAction) => {
    const ids = [...selectedRowIds];
    if (ids.length === 0) return;

    const method = action === 'restore' ? 'POST' : 'DELETE';
    const body = JSON.stringify({
      ids,
      action,
    });

    await fetch(
      `/api/v1/data/${DEFAULT_WORKSPACE_ID}/${schemaSlug}/${selectedTableId ?? ''}/bulk`,
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      },
    );

    setSelectedRowIds(new Set());
    void fetchRows(page);
  };

  // ── FK search ─────────────────────────────────────────────────────────────

  const handleFkSearch = async (columnId: string, query: string) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col?.foreignKey) return [];
    try {
      const fk = col.foreignKey;
      const res = await fetch(
        `/api/v1/data/${DEFAULT_WORKSPACE_ID}/${schemaSlug}/${fk.targetTableId}?search=${encodeURIComponent(query)}&pageSize=20`,
      );
      if (res.ok) {
        const data = (await res.json()) as { rows: Record<string, unknown>[] };
        const displayCol = fk.displayColumn ?? 'name';
        return data.rows.map((r) => {
          const rawId = r['id'];
          const rawLabel = r[displayCol] ?? rawId;
          const id = rawId !== null && rawId !== undefined ? String(rawId as string | number) : '';
          const label =
            rawLabel !== null && rawLabel !== undefined ? String(rawLabel as string | number) : id;
          return { id, label };
        });
      }
    } catch {
      /* ignore */
    }
    return [];
  };

  // ── Row delete ────────────────────────────────────────────────────────────

  const handleRowDelete = async (rowId: string, hard = false) => {
    await fetch(
      `/api/v1/data/${DEFAULT_WORKSPACE_ID}/${schemaSlug}/${selectedTableId ?? ''}/${rowId}${hard ? '?hard=true' : ''}`,
      { method: 'DELETE' },
    );
    setDetailRow(null);
    void fetchRows(page);
  };

  // ── Views ─────────────────────────────────────────────────────────────────

  const handleSelectView = (viewId: string | null) => {
    const view = viewId ? (savedViews.find((v) => v.id === viewId) ?? null) : null;
    setActiveView(view);
    if (view) {
      setFilter(view.filterConfig);
      setSortConfig(view.sortConfig);
    }
    updateUrl(selectedTableId, viewId);
  };

  const handleSaveView = async (name: string, description: string, shared: boolean) => {
    await fetch(`/api/v1/data/${DEFAULT_WORKSPACE_ID}/browser/views`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaSlug,
        tableId: selectedTableId,
        name,
        description,
        filterConfig: filter,
        sortConfig,
        shared,
      }),
    });
    // Refresh views
    const res = await fetch(
      `/api/v1/data/${DEFAULT_WORKSPACE_ID}/browser/views?schemaSlug=${schemaSlug}&tableId=${selectedTableId ?? ''}`,
    );
    if (res.ok) {
      const data = (await res.json()) as { views: DataBrowserView[] };
      setSavedViews(data.views);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <Toolbar
        activeView={activeView}
        savedViews={savedViews}
        hasFilter={filter !== null}
        sortCount={sortConfig.length}
        realtimeEnabled={realtimeEnabled}
        canImport
        canExport
        onOpenFilter={() => {
          setDialog('filter');
        }}
        onClearFilter={() => {
          setFilter(null);
          setPage(1);
        }}
        onOpenExport={() => {
          setDialog('export');
        }}
        onOpenImport={() => {
          setDialog('import');
        }}
        onSaveView={() => {
          setDialog('save_view');
        }}
        onSelectView={handleSelectView}
        onToggleRealtime={() => {
          setRealtimeEnabled((v) => !v);
        }}
        onRefresh={() => void fetchRows(page)}
        onOpenSchemaRef={() => {
          setDialog('schema_ref');
        }}
      />

      {selectedRowIds.size > 0 && (
        <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-4 py-1.5 text-sm">
          <span className="font-medium">{selectedRowIds.size} rows selected</span>
          <button
            type="button"
            className="rounded px-2 py-0.5 hover:bg-muted text-xs"
            onClick={() => {
              setDialog({ kind: 'bulk', action: 'archive' });
            }}
          >
            Archive
          </button>
          <button
            type="button"
            className="rounded px-2 py-0.5 hover:bg-muted text-xs"
            onClick={() => {
              setDialog({ kind: 'bulk', action: 'restore' });
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="rounded px-2 py-0.5 hover:bg-destructive/10 text-destructive text-xs"
            onClick={() => {
              setDialog({ kind: 'bulk', action: 'hard_delete' });
            }}
          >
            Delete permanently
          </button>
          <button
            type="button"
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSelectedRowIds(new Set());
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <TablePicker
          tables={tables}
          selectedTableId={selectedTableId}
          loading={tablesLoading}
          onSelect={(id) => {
            setSelectedTableId(id);
            setSelectedRowIds(new Set());
            setDetailRow(null);
            updateUrl(id, activeView?.id ?? null);
          }}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          {loading && (
            <div className="border-b border-border bg-primary/5 px-4 py-1 text-xs text-primary">
              Loading…
            </div>
          )}

          {!selectedTableId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a table to browse
            </div>
          ) : (
            <Grid
              rows={rows}
              columns={columns}
              sortConfig={sortConfig}
              selectedRowIds={selectedRowIds}
              fkLabels={fkLabels}
              onSortChange={handleSortChange}
              onRowSelect={handleRowSelect}
              onRowClick={(row) => {
                setDetailRow(row);
              }}
              onCellSave={handleCellSave}
              onFkSearch={handleFkSearch}
              pendingRealtimeRowIds={pendingRealtimeRowIds}
              highlightedRowIds={highlightedRowIds}
            />
          )}

          <StatusBar
            totalRows={totalRows}
            loadedRows={rows.length}
            selectedCount={selectedRowIds.size}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            realtimeEventsOutsideView={realtimeEventsOutsideView}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(Math.min(s, MAX_PAGE_SIZE));
              setPage(1);
            }}
            onClearSelection={() => {
              setSelectedRowIds(new Set());
            }}
          />
        </div>

        {detailRow && selectedTable && (
          <RowDetailPanel
            row={detailRow}
            columns={columns}
            onClose={() => {
              setDetailRow(null);
            }}
            onSave={async (rowId, changes) => {
              const version = Number(detailRow['_version'] ?? 1);
              await fetch(
                `/api/v1/data/${DEFAULT_WORKSPACE_ID}/${schemaSlug}/${selectedTableId ?? ''}/${rowId}`,
                {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...changes, _version: version }),
                },
              );
              void fetchRows(page);
            }}
            onDelete={(rowId, _hard) => {
              setDialog({ kind: 'delete_row', rowId });
            }}
            fkLabels={fkLabels}
            onFkSearch={handleFkSearch}
          />
        )}
      </div>

      {/* Dialogs */}
      {dialog === 'filter' && (
        <FilterDialog
          columns={columns}
          initialFilter={filter}
          onApply={(f) => {
            setFilter(f);
            setPage(1);
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}

      {dialog === 'export' && selectedTableId && (
        <ExportDialog
          tableId={selectedTableId}
          hasFilter={filter !== null}
          onExport={async (format, scope) => {
            await fetch(`/api/v1/data/${DEFAULT_WORKSPACE_ID}/browser/exports`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schemaSlug,
                tableId: selectedTableId,
                filterConfig: filter,
                sortConfig,
                format,
                scope,
              }),
            });
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}

      {dialog === 'import' && selectedTableId && (
        <ImportDialog
          columns={columns}
          tableId={selectedTableId}
          onImport={async (sourceFileId, columnMapping, onError) => {
            await fetch(`/api/v1/data/${DEFAULT_WORKSPACE_ID}/browser/imports`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schemaSlug,
                tableId: selectedTableId,
                sourceFileId,
                columnMapping,
                onError,
              }),
            });
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}

      {dialog === 'save_view' && (
        <SaveViewDialog
          existingName={activeView?.name}
          onSave={handleSaveView}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}

      {dialog === 'schema_ref' && selectedTable && (
        <SchemaQuickReferenceDialog
          tableName={selectedTable.name}
          columns={columns}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}

      {typeof dialog === 'object' &&
        dialog !== null &&
        'kind' in dialog &&
        dialog.kind === 'bulk' && (
          <BulkActionDialog
            action={dialog.action}
            count={selectedRowIds.size}
            onConfirm={() => handleBulkAction(dialog.action)}
            onClose={() => {
              setDialog(null);
            }}
          />
        )}

      {typeof dialog === 'object' &&
        dialog !== null &&
        'kind' in dialog &&
        dialog.kind === 'delete_row' && (
          <RowDeleteConfirmDialog
            rowId={dialog.rowId}
            onConfirm={() => handleRowDelete(dialog.rowId)}
            onClose={() => {
              setDialog(null);
            }}
          />
        )}
    </div>
  );
}
