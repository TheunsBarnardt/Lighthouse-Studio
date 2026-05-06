'use client';

import { useState } from 'react';

import type { ColumnDefinition, FilterNode } from '../types.js';

interface FilterDialogProps {
  columns: ColumnDefinition[];
  initialFilter: FilterNode | null;
  onApply: (filter: FilterNode | null) => void;
  onClose: () => void;
}

type OpGroupKey = 'string' | 'number' | 'boolean' | 'date' | 'default';
const OPERATOR_LABELS: Record<OpGroupKey, Record<string, string>> = {
  string: {
    _eq: '=',
    _neq: '≠',
    _like: 'contains',
    _ilike: 'contains (case-insensitive)',
    _isNull: 'is empty',
    _in: 'is one of',
  },
  number: { _eq: '=', _neq: '≠', _gt: '>', _gte: '≥', _lt: '<', _lte: '≤', _isNull: 'is empty' },
  boolean: { _eq: '=', _isNull: 'is empty' },
  date: {
    _eq: '=',
    _gt: 'after',
    _gte: 'on or after',
    _lt: 'before',
    _lte: 'on or before',
    _isNull: 'is empty',
  },
  default: { _eq: '=', _neq: '≠', _isNull: 'is empty' },
};

function operatorsFor(col: ColumnDefinition): string[] {
  if (['string', 'text', 'uuid'].includes(col.type)) return Object.keys(OPERATOR_LABELS.string);
  if (['number', 'decimal'].includes(col.type)) return Object.keys(OPERATOR_LABELS.number);
  if (col.type === 'boolean') return Object.keys(OPERATOR_LABELS.boolean);
  if (['date', 'datetime'].includes(col.type)) return Object.keys(OPERATOR_LABELS.date);
  return Object.keys(OPERATOR_LABELS.default);
}

function labelFor(col: ColumnDefinition, op: string): string {
  let map = OPERATOR_LABELS.default;
  if (['string', 'text', 'uuid'].includes(col.type)) map = OPERATOR_LABELS.string;
  else if (['number', 'decimal'].includes(col.type)) map = OPERATOR_LABELS.number;
  else if (col.type === 'boolean') map = OPERATOR_LABELS.boolean;
  else if (['date', 'datetime'].includes(col.type)) map = OPERATOR_LABELS.date;
  return map[op] ?? op;
}

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
  id: number;
}

let condId = 0;

export function FilterDialog({ columns, initialFilter, onApply, onClose }: FilterDialogProps) {
  const [logic, setLogic] = useState<'and' | 'or'>('and');
  const [conditions, setConditions] = useState<ConditionRow[]>(() => {
    if (initialFilter?.type === 'group' && initialFilter.children) {
      return initialFilter.children
        .filter((c): c is FilterNode & { type: 'condition' } => c.type === 'condition')
        .map((c) => ({
          id: ++condId,
          field: c.field ?? '',
          operator: c.operator ?? '_eq',
          value:
            c.value !== undefined && c.value !== null
              ? String(c.value as string | number | boolean)
              : '',
        }));
    }
    return [{ id: ++condId, field: columns[0]?.id ?? '', operator: '_eq', value: '' }];
  });

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { id: ++condId, field: columns[0]?.id ?? '', operator: '_eq', value: '' },
    ]);
  };

  const removeCondition = (id: number) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCondition = (id: number, patch: Partial<ConditionRow>) => {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const handleApply = () => {
    const valid = conditions.filter((c) => c.field && c.operator);
    if (valid.length === 0) {
      onApply(null);
      return;
    }
    const filter: FilterNode = {
      type: 'group',
      logic,
      children: valid.map((c) => ({
        type: 'condition',
        field: c.field,
        operator: c.operator,
        value: c.operator === '_isNull' ? null : c.value,
      })),
    };
    onApply(filter);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filter"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-2xl rounded-lg border border-border bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Filter Rows</h2>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Match</span>
          <select
            className="rounded border border-border bg-background px-2 py-1 text-sm"
            value={logic}
            onChange={(e) => {
              setLogic(e.target.value as 'and' | 'or');
            }}
          >
            <option value="and">ALL conditions (AND)</option>
            <option value="or">ANY condition (OR)</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 mb-4">
          {conditions.map((cond) => {
            const col = columns.find((c) => c.id === cond.field);
            const operators = col ? operatorsFor(col) : ['_eq'];

            return (
              <div key={cond.id} className="flex items-center gap-2">
                <select
                  className="rounded border border-border bg-background px-2 py-1 text-sm flex-1"
                  value={cond.field}
                  onChange={(e) => {
                    updateCondition(cond.id, { field: e.target.value, operator: '_eq' });
                  }}
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded border border-border bg-background px-2 py-1 text-sm"
                  value={cond.operator}
                  onChange={(e) => {
                    updateCondition(cond.id, { operator: e.target.value });
                  }}
                >
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {col ? labelFor(col, op) : op}
                    </option>
                  ))}
                </select>

                {cond.operator !== '_isNull' && (
                  <input
                    type={
                      col?.type === 'number' || col?.type === 'decimal'
                        ? 'number'
                        : col?.type === 'date'
                          ? 'date'
                          : 'text'
                    }
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                    value={cond.value}
                    placeholder="Value…"
                    onChange={(e) => {
                      updateCondition(cond.id, { value: e.target.value });
                    }}
                  />
                )}

                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive px-1"
                  onClick={() => {
                    removeCondition(cond.id);
                  }}
                  aria-label="Remove condition"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="mb-4 text-sm text-primary hover:underline"
          onClick={addCondition}
        >
          + Add condition
        </button>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-4 py-2 text-sm hover:bg-muted"
            onClick={() => {
              onApply(null);
              onClose();
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="rounded bg-muted px-4 py-2 text-sm hover:bg-muted/80"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              handleApply();
              onClose();
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
