'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DRIVER_CAPABILITIES,
  type ColumnDefinition,
  type DatabaseDriver,
  type NormalizedType,
  type PiiCategory,
} from '@/lib/types';
import { useDesignerStore } from '@/state/designer-store';

const ALL_KINDS: NormalizedType['kind'][] = [
  'text',
  'string',
  'integer',
  'bigint',
  'decimal',
  'boolean',
  'date',
  'timestamp',
  'timestamp_tz',
  'uuid',
  'binary',
  'json',
  'array',
];

function kindLabel(kind: NormalizedType['kind']): string {
  const map: Record<NormalizedType['kind'], string> = {
    text: 'text',
    string: 'varchar',
    integer: 'integer',
    bigint: 'bigint',
    decimal: 'decimal',
    boolean: 'boolean',
    date: 'date',
    timestamp: 'timestamp',
    timestamp_tz: 'timestamptz',
    uuid: 'uuid',
    binary: 'binary',
    json: 'json',
    array: 'array[]',
  };
  return map[kind];
}

interface ColumnRowProps {
  tableId: string;
  column: ColumnDefinition;
  isPrimaryKey: boolean;
  driver: DatabaseDriver;
}

export function ColumnRow({ tableId, column, isPrimaryKey, driver }: ColumnRowProps) {
  const updateSchema = useDesignerStore((s) => s.updateSchema);
  const caps = DRIVER_CAPABILITIES[driver];

  const update = (changes: Partial<ColumnDefinition>) => {
    updateSchema((s) => {
      const table = s.tables.find((t) => t.id === tableId);
      if (!table) return;
      const col = table.columns.find((c) => c.id === column.id);
      if (!col) return;
      Object.assign(col, changes);
    });
  };

  const handleRemove = () => {
    updateSchema((s) => {
      const table = s.tables.find((t) => t.id === tableId);
      if (!table) return;
      table.columns = table.columns.filter((c) => c.id !== column.id);
      if (table.primaryKey.kind === 'single' && table.primaryKey.columnId === column.id) {
        table.primaryKey = { kind: 'single', columnId: '' };
      }
    });
  };

  return (
    <tr className="group border-b border-border last:border-0 hover:bg-muted/40">
      {/* PK indicator */}
      <td className="w-8 px-2 text-center">
        {isPrimaryKey && (
          <span
            className="text-xs font-bold text-warning"
            title="Primary key"
            aria-label="Primary key"
          >
            PK
          </span>
        )}
      </td>

      {/* Name */}
      <td className="px-2 py-1.5">
        <Input
          value={column.name}
          onChange={(e) => {
            update({ name: e.target.value });
          }}
          className="h-7 font-mono text-xs"
          placeholder="column_name"
          aria-label={`Column name`}
          pattern="[a-z][a-z0-9_]*"
          title="Lowercase letters, numbers, and underscores only"
        />
      </td>

      {/* Type */}
      <td className="px-2 py-1.5">
        <Tooltip
          content={
            !caps.arrays && column.type.kind === 'array'
              ? `Array columns are not supported on ${driver.toUpperCase()}`
              : undefined
          }
          side="top"
        >
          <Select
            value={column.type.kind}
            onChange={(e) => {
              const kind = e.target.value as NormalizedType['kind'];
              update({
                type:
                  kind === 'decimal'
                    ? { kind: 'decimal', precision: 10, scale: 2 }
                    : kind === 'string'
                      ? { kind: 'string', length: 255 }
                      : kind === 'array'
                        ? { kind: 'array', elementType: { kind: 'text' } }
                        : ({ kind } as NormalizedType),
              });
            }}
            disabled={!caps.arrays && column.type.kind === 'array'}
            aria-label="Column type"
            className="h-7 font-mono text-xs"
          >
            {ALL_KINDS.map((k) => (
              <option
                key={k}
                value={k}
                disabled={k === 'array' && !caps.arrays}
                title={k === 'array' && !caps.arrays ? `Not supported on ${driver}` : undefined}
              >
                {kindLabel(k)}
                {k === 'array' && !caps.arrays ? ' (not supported)' : ''}
              </option>
            ))}
          </Select>
        </Tooltip>
      </td>

      {/* Nullable */}
      <td className="w-20 px-2 py-1.5 text-center">
        <input
          type="checkbox"
          checked={column.nullable}
          onChange={(e) => {
            update({ nullable: e.target.checked });
          }}
          disabled={isPrimaryKey}
          className="h-4 w-4 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed"
          aria-label="Nullable"
        />
      </td>

      {/* PII */}
      <td className="w-16 px-2 py-1.5 text-center">
        <input
          type="checkbox"
          checked={column.isPii ?? false}
          onChange={(e) => {
            update({ isPii: e.target.checked });
          }}
          className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
          aria-label="Mark as PII"
        />
      </td>

      {/* PII Category */}
      <td className="px-2 py-1.5">
        {column.isPii && (
          <Select
            value={column.piiCategory ?? ''}
            onChange={(e) => {
              const val = e.target.value as PiiCategory | '';
              if (val !== '') update({ piiCategory: val });
            }}
            className="h-7 text-xs"
            aria-label="PII category"
          >
            <option value="">Select category</option>
            <option value="contact">Contact</option>
            <option value="identification">Identification</option>
            <option value="financial">Financial</option>
            <option value="health">Health</option>
            <option value="behavioral">Behavioral</option>
            <option value="location">Location</option>
            <option value="credential">Credential</option>
            <option value="other">Other</option>
          </Select>
        )}
      </td>

      {/* Description */}
      <td className="px-2 py-1.5">
        <Input
          value={column.description ?? ''}
          onChange={(e) => {
            update({ description: e.target.value });
          }}
          className="h-7 text-xs"
          placeholder="Optional description"
          aria-label="Column description"
        />
      </td>

      {/* Remove */}
      <td className="w-10 px-2 py-1.5 text-center opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="icon"
          variant="ghost"
          onClick={handleRemove}
          disabled={isPrimaryKey}
          aria-label={`Remove column ${column.name}`}
          className="h-6 w-6 text-muted-foreground hover:text-error"
        >
          ×
        </Button>
      </td>
    </tr>
  );
}
