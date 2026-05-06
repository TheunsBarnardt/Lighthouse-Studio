'use client';

import Papa from 'papaparse';
import { useRef, useState } from 'react';

import type { ColumnDefinition } from '../types.js';

interface ImportDialogProps {
  columns: ColumnDefinition[];
  tableId: string;
  onImport: (
    sourceFileId: string,
    columnMapping: Record<string, string>,
    onError: 'skip' | 'fail',
  ) => Promise<void>;
  onClose: () => void;
}

type Phase = 'upload' | 'preview' | 'importing';

interface PreviewData {
  headers: string[];
  rows: string[][];
  totalRows: number;
  validationErrors: Array<{ row: number; message: string }>;
  mapping: Record<string, string>;
}

export function ImportDialog({ columns, onImport, onClose }: ImportDialogProps) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [onError, setOnError] = useState<'skip' | 'fail'>('skip');
  const [isDragging, setIsDragging] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);

  const handleFile = (file: File) => {
    fileRef.current = file;
    setPhase('preview');
    Papa.parse<string[]>(file, {
      preview: 100,
      complete: (results) => {
        const [headers = [], ...dataRows] = results.data;
        const mapping: Record<string, string> = {};
        for (const header of headers) {
          const match = columns.find((c) => c.name.toLowerCase() === header.toLowerCase());
          if (match) mapping[header] = match.id;
        }

        const errors: PreviewData['validationErrors'] = [];
        // Basic type validation on preview rows
        for (let i = 0; i < Math.min(dataRows.length, 100); i++) {
          const row = dataRows[i] ?? [];
          for (const [csvHeader, colId] of Object.entries(mapping)) {
            const colDef = columns.find((c) => c.id === colId);
            const idx = headers.indexOf(csvHeader);
            const val = row[idx] ?? '';
            if (colDef?.required && val === '') {
              errors.push({ row: i + 2, message: `Column "${colDef.name}" is required` });
            }
            if (
              colDef &&
              ['number', 'decimal'].includes(colDef.type) &&
              val !== '' &&
              isNaN(Number(val))
            ) {
              errors.push({
                row: i + 2,
                message: `Column "${colDef.name}" must be numeric (got "${val}")`,
              });
            }
          }
        }

        // Count total rows in background
        let total = 0;
        Papa.parse<string[]>(file, {
          complete: (r) => {
            total = r.data.length - 1;
            setPreview((p) => (p ? { ...p, totalRows: total } : p));
          },
        });

        setPreview({
          headers,
          rows: dataRows.slice(0, 5),
          totalRows: dataRows.length,
          validationErrors: errors,
          mapping,
        });
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.json'))) {
      handleFile(file);
    }
  };

  const handleConfirm = async () => {
    if (!preview || !fileRef.current) return;
    setPhase('importing');
    setImportProgress('Uploading file…');
    // In a real impl, the file is uploaded via StorageService first to get a fileId.
    // For now, we use the filename as a placeholder until storage integration lands.
    setImportProgress('Starting import job…');
    await onImport('__file__:' + fileRef.current.name, preview.mapping, onError);
    setImportProgress('Import started — you can close this dialog.');
  };

  if (phase === 'upload') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      >
        <div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Import Data</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => {
              setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <p className="mb-2 text-sm font-medium">Drop a CSV or JSON file here</p>
            <p className="mb-4 text-xs text-muted-foreground">Max 100,000 rows</p>
            <label className="cursor-pointer rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
              Choose File
              <input
                type="file"
                className="hidden"
                accept=".csv,.json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'preview' && preview) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import Preview"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      >
        <div className="w-full max-w-3xl rounded-lg border border-border bg-background p-6 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Preview Import</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          <p className="mb-3 text-sm text-muted-foreground">
            {preview.totalRows.toLocaleString()} rows detected.{' '}
            {preview.validationErrors.length > 0 && (
              <span className="text-destructive">
                {preview.validationErrors.length} validation error
                {preview.validationErrors.length !== 1 ? 's' : ''} in sample.{' '}
              </span>
            )}
          </p>

          <div className="mb-4 overflow-x-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  {preview.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      <span>{h}</span>
                      {preview.mapping[h] && (
                        <span className="ml-1 text-primary">
                          →{' '}
                          {columns.find((c) => c.id === preview.mapping[h])?.name ??
                            preview.mapping[h]}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 text-muted-foreground">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm">On row errors:</span>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                value="skip"
                checked={onError === 'skip'}
                onChange={() => {
                  setOnError('skip');
                }}
              />
              Skip errored rows
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                value="fail"
                checked={onError === 'fail'}
                onChange={() => {
                  setOnError('fail');
                }}
              />
              Fail entire import
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPhase('upload');
              }}
              className="rounded px-4 py-2 text-sm hover:bg-muted"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Import {preview.totalRows.toLocaleString()} rows
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Importing"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl text-center">
        <h2 className="mb-3 text-lg font-semibold">Importing…</h2>
        <p className="mb-4 text-sm text-muted-foreground">{importProgress}</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-muted px-4 py-2 text-sm hover:bg-muted/80"
        >
          Close (runs in background)
        </button>
      </div>
    </div>
  );
}
