'use client';

interface StatusBarProps {
  totalRows: number;
  loadedRows?: number;
  selectedCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  realtimeEventsOutsideView: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onClearSelection: () => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250, 500];

export function StatusBar({
  totalRows,
  loadedRows: _loadedRows,
  selectedCount,
  page,
  pageSize,
  totalPages,
  realtimeEventsOutsideView,
  onPageChange,
  onPageSizeChange,
  onClearSelection,
}: StatusBarProps) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalRows);

  return (
    <div
      className="flex items-center gap-3 border-t border-border bg-background px-3 py-1.5 text-xs text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {selectedCount > 0 && (
        <span className="flex items-center gap-1">
          <span className="font-medium text-foreground">
            {selectedCount.toLocaleString()} selected
          </span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClearSelection}
            aria-label="Clear selection"
          >
            ×
          </button>
        </span>
      )}

      <span>
        {totalRows > 0
          ? `${from.toLocaleString()}–${to.toLocaleString()} of ${totalRows.toLocaleString()} rows`
          : 'No rows'}
      </span>

      {realtimeEventsOutsideView > 0 && (
        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
          {realtimeEventsOutsideView} update{realtimeEventsOutsideView !== 1 ? 's' : ''} outside
          view
        </span>
      )}

      <div className="flex-1" />

      {/* Page size */}
      <label className="flex items-center gap-1">
        Rows per page:
        <select
          className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          value={pageSize}
          onChange={(e) => {
            onPageSizeChange(Number(e.target.value));
          }}
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {/* Pagination */}
      <div className="flex items-center gap-1" role="navigation" aria-label="Pagination">
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-muted disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(1);
          }}
          aria-label="First page"
        >
          «
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-muted disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => {
            onPageChange(page - 1);
          }}
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="px-1">
          Page {page} of {totalPages || 1}
        </span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-muted disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => {
            onPageChange(page + 1);
          }}
          aria-label="Next page"
        >
          ›
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 hover:bg-muted disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => {
            onPageChange(totalPages);
          }}
          aria-label="Last page"
        >
          »
        </button>
      </div>
    </div>
  );
}
