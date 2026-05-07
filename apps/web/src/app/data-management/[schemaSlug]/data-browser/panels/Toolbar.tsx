'use client';

import type { DataBrowserView } from '../types.js';

interface ToolbarProps {
  activeView: DataBrowserView | null;
  savedViews: DataBrowserView[];
  hasFilter: boolean;
  sortCount: number;
  realtimeEnabled: boolean;
  canImport: boolean;
  canExport: boolean;
  onOpenFilter: () => void;
  onClearFilter: () => void;
  onOpenExport: () => void;
  onOpenImport: () => void;
  onSaveView: () => void;
  onSelectView: (viewId: string | null) => void;
  onToggleRealtime: () => void;
  onRefresh: () => void;
  onOpenSchemaRef: () => void;
}

export function Toolbar({
  activeView,
  savedViews,
  hasFilter,
  sortCount,
  realtimeEnabled,
  canImport,
  canExport,
  onOpenFilter,
  onClearFilter,
  onOpenExport,
  onOpenImport,
  onSaveView,
  onSelectView,
  onToggleRealtime,
  onRefresh,
  onOpenSchemaRef,
}: ToolbarProps) {
  return (
    <div
      className="flex items-center gap-2 border-b border-border bg-background px-3 py-2"
      role="toolbar"
      aria-label="Data browser toolbar"
    >
      {/* Views selector */}
      <select
        className="rounded border border-border bg-background px-2 py-1 text-sm"
        value={activeView?.id ?? ''}
        onChange={(e) => {
          onSelectView(e.target.value || null);
        }}
        aria-label="Select saved view"
      >
        <option value="">Default view</option>
        {savedViews.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="rounded px-2 py-1 text-xs hover:bg-muted"
        onClick={onSaveView}
        title="Save current view"
      >
        Save view
      </button>

      <div className="mx-1 h-4 w-px bg-border" aria-hidden />

      {/* Filter */}
      <button
        type="button"
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${hasFilter ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
        onClick={onOpenFilter}
        aria-pressed={hasFilter}
        aria-label="Filter"
      >
        Filter
        {hasFilter && (
          <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1">
            ●
          </span>
        )}
      </button>

      {hasFilter && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-destructive"
          onClick={onClearFilter}
          aria-label="Clear filter"
        >
          ×
        </button>
      )}

      {sortCount > 0 && (
        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {sortCount} sort{sortCount !== 1 ? 's' : ''}
        </span>
      )}

      <div className="flex-1" />

      <button
        type="button"
        className="rounded px-2 py-1 text-xs hover:bg-muted"
        onClick={onOpenSchemaRef}
        title="Schema reference"
        aria-label="Schema reference"
      >
        Schema
      </button>

      {/* Realtime toggle */}
      <button
        type="button"
        className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${realtimeEnabled ? 'text-green-600' : 'text-muted-foreground'}`}
        onClick={onToggleRealtime}
        aria-pressed={realtimeEnabled}
        aria-label={realtimeEnabled ? 'Disable real-time updates' : 'Enable real-time updates'}
        title={realtimeEnabled ? 'Real-time on' : 'Real-time off'}
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${realtimeEnabled ? 'bg-green-500' : 'bg-muted-foreground'}`}
        />
        Live
      </button>

      <button
        type="button"
        className="rounded px-2 py-1 text-xs hover:bg-muted"
        onClick={onRefresh}
        aria-label="Refresh"
        title="Refresh"
      >
        ↻
      </button>

      {canImport && (
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          onClick={onOpenImport}
          aria-label="Import"
        >
          Import
        </button>
      )}

      {canExport && (
        <button
          type="button"
          className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          onClick={onOpenExport}
          aria-label="Export"
        >
          Export
        </button>
      )}
    </div>
  );
}
