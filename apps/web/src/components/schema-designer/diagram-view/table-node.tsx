'use client';

import type { Node, NodeProps } from '@xyflow/react';

import { Handle, Position } from '@xyflow/react';

import type { TableDefinition } from '@/lib/types';

import { normalizedTypeName } from '@/lib/schema-utils';
import { cn } from '@/lib/utils';

export interface TableNodeData extends Record<string, unknown> {
  table: TableDefinition;
  selected: boolean;
  onSelect: (id: string) => void;
}

export type TableNodeType = Node<TableNodeData, 'tableNode'>;

export function TableNode({ data }: NodeProps<TableNodeType>) {
  const { table, selected, onSelect } = data;

  const pkColumnIds = new Set(
    table.primaryKey.kind === 'single' ? [table.primaryKey.columnId] : table.primaryKey.columnIds,
  );

  return (
    <div
      className={cn(
        'min-w-[200px] max-w-[280px] rounded-lg border-2 bg-card shadow-md',
        'cursor-pointer select-none',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
      )}
      onClick={() => {
        onSelect(table.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect(table.id);
      }}
      tabIndex={0}
      role="button"
      aria-label={`Table: ${table.name}`}
      aria-pressed={selected}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between rounded-t-md px-3 py-2',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted',
        )}
      >
        <span className="truncate text-sm font-semibold">{table.name}</span>
        <span className="ml-2 shrink-0 text-xs opacity-70">{table.columns.length}</span>
      </div>

      {/* Columns */}
      <div className="divide-y divide-border">
        {table.columns.slice(0, 8).map((col) => (
          <div key={col.id} className="flex items-center gap-2 px-3 py-1.5">
            <span
              className={cn(
                'shrink-0 font-mono text-xs font-bold',
                pkColumnIds.has(col.id) ? 'text-warning' : 'text-muted-foreground',
              )}
              title={pkColumnIds.has(col.id) ? 'Primary key' : undefined}
            >
              {pkColumnIds.has(col.id) ? 'PK' : '  '}
            </span>
            <span className="flex-1 truncate text-xs">{col.name}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {normalizedTypeName(col.type)}
            </span>
          </div>
        ))}
        {table.columns.length > 8 && (
          <div className="px-3 py-1.5 text-center text-xs text-muted-foreground">
            +{table.columns.length - 8} more
          </div>
        )}
      </div>

      {/* Connection handles (invisible, used by @xyflow for edges) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-border !bg-card"
        aria-hidden="true"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-border !bg-card"
        aria-hidden="true"
      />
    </div>
  );
}
