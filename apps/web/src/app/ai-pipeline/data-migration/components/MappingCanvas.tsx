'use client';

import type { ColumnMapping } from '../types.js';

interface MappingCanvasProps {
  onMappingSelected: (mapping: ColumnMapping) => void;
}

const MOCK_MAPPINGS: ColumnMapping[] = [
  { id: 'm1', sourceTable: 'customers', sourceColumn: 'id', targetTable: 'users', targetColumn: 'id', transformations: [{ type: 'parse_int', parameters: {} }] },
  { id: 'm2', sourceTable: 'customers', sourceColumn: 'full_name', targetTable: 'users', targetColumn: 'display_name', transformations: [{ type: 'trim', parameters: {} }] },
  { id: 'm3', sourceTable: 'customers', sourceColumn: 'email', targetTable: 'users', targetColumn: 'email', transformations: [] },
  { id: 'm4', sourceTable: 'customers', sourceColumn: 'created', targetTable: 'users', targetColumn: 'created_at', transformations: [{ type: 'parse_date', parameters: {} }] },
];

const SOURCE_COLS = ['id', 'full_name', 'email', 'created'];
const TARGET_COLS = ['id', 'display_name', 'email', 'created_at', 'updated_at'];

export function MappingCanvas({ onMappingSelected }: MappingCanvasProps) {
  return (
    <div className="p-6">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Visual Mapping Editor</h3>
        <p className="text-xs text-muted-foreground">Click a connection line to edit transformations</p>
      </div>

      <div className="flex gap-8">
        {/* Source panel */}
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source: customers</span>
          </div>
          <div className="divide-y divide-border">
            {SOURCE_COLS.map(col => (
              <div key={col} className="px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-mono text-foreground">{col}</span>
                <span className="text-xs text-muted-foreground">
                  {col === 'id' ? 'integer' : col === 'created' ? 'timestamp' : 'varchar'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Connections */}
        <div className="flex flex-col justify-center gap-2 w-32">
          {MOCK_MAPPINGS.map(m => (
            <button
              key={m.id}
              onClick={() => onMappingSelected(m)}
              className="relative flex items-center gap-1 hover:opacity-80 group"
              title={`${m.sourceColumn} → ${m.targetColumn}`}
            >
              <div className="h-px flex-1 bg-primary" />
              {m.transformations.length > 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 bg-primary/10 border border-primary/30 text-primary text-xs px-1 rounded">
                  {m.transformations.length}
                </span>
              )}
              <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
            </button>
          ))}
          <button className="text-xs text-muted-foreground hover:text-primary mt-2">+ Add connection</button>
        </div>

        {/* Target panel */}
        <div className="flex-1 border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-muted border-b border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target: users</span>
          </div>
          <div className="divide-y divide-border">
            {TARGET_COLS.map(col => {
              const isMapped = MOCK_MAPPINGS.some(m => m.targetColumn === col);
              return (
                <div key={col} className={`px-3 py-2 flex items-center justify-between ${!isMapped ? 'opacity-50' : ''}`}>
                  <span className="text-sm font-mono text-foreground">{col}</span>
                  {!isMapped && <span className="text-xs text-amber-500">unmapped</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-3 h-px bg-primary inline-block" /> Direct mapping</span>
        <span className="flex items-center gap-1"><span className="w-3 h-px bg-primary inline-block" /><span className="bg-primary/10 border border-primary/30 text-primary px-1 rounded">n</span> With transformations</span>
        <span className="flex items-center gap-1"><span className="w-3 h-px bg-amber-400 inline-block" /> Warning</span>
      </div>
    </div>
  );
}
