'use client';

import { useState } from 'react';

interface SchemaColumn {
  name: string;
  type?: string;
  nullable?: boolean;
}

interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

interface SchemaPanelProps {
  tables: SchemaTable[];
  onInsert: (text: string) => void;
}

export function SchemaPanel({ tables, onInsert }: SchemaPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        Schema not loaded
      </div>
    );
  }

  function toggle(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
      {tables.map((table) => (
        <div key={table.name}>
          <button
            type="button"
            onClick={() => { toggle(table.name); }}
            className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm font-medium hover:bg-muted/60"
          >
            <span className="text-muted-foreground">{expanded.has(table.name) ? '▼' : '▶'}</span>
            <span
              role="button"
              tabIndex={0}
              onDoubleClick={() => { onInsert(table.name); }}
              onKeyDown={(e) => { if (e.key === 'Enter') onInsert(table.name); }}
              title="Double-click to insert table name"
            >
              {table.name}
            </span>
          </button>

          {expanded.has(table.name) && (
            <div className="pl-5">
              {table.columns.map((col) => (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => { onInsert(col.name); }}
                  className="flex w-full items-center gap-1 rounded px-2 py-0.5 text-left text-xs hover:bg-muted/40"
                >
                  <span className="font-mono">{col.name}</span>
                  {col.type && (
                    <span className="ml-1 text-muted-foreground opacity-70">{col.type}</span>
                  )}
                  {col.nullable === false && (
                    <span className="ml-auto text-xs text-orange-500">NOT NULL</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
