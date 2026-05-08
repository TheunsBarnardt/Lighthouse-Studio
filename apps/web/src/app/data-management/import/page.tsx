'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { CustomerSchema, DatabaseDriver } from '@/lib/types';

import { useImportSchema } from '@/hooks/useSchemaService';

// eslint-disable-next-line no-restricted-syntax
const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

const inputStyle = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  background: 'var(--bg-canvas)',
  color: 'var(--fg-primary)',
  fontSize: 13,
};

export default function ImportSchemaPage() {
  const router = useRouter();
  const importSchema = useImportSchema(DEFAULT_WORKSPACE_ID);
  const fileRef = useRef<HTMLInputElement>(null);
  const [jsonContent, setJsonContent] = useState('');
  const [driver, setDriver] = useState<DatabaseDriver>('postgres');
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; tables: number } | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonContent(text);
      try {
        const parsed = JSON.parse(text) as Partial<CustomerSchema>;
        setPreview({ name: parsed.name ?? 'Unknown', tables: parsed.tables?.length ?? 0 });
        setParseError(null);
      } catch {
        setParseError('Invalid JSON — could not parse the file.');
        setPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const handlePaste = (text: string) => {
    setJsonContent(text);
    try {
      const parsed = JSON.parse(text) as Partial<CustomerSchema>;
      setPreview({ name: parsed.name ?? 'Unknown', tables: parsed.tables?.length ?? 0 });
      setParseError(null);
    } catch {
      setParseError('Invalid JSON.');
      setPreview(null);
    }
  };

  const handleImport = () => {
    if (!jsonContent) return;
    importSchema.mutate(
      { format: 'json', content: jsonContent, databaseDriver: driver },
      {
        onSuccess: (schema) => {
          router.push(`/data-management/${schema.slug}`);
        },
        onError: (e) => {
          setParseError(e instanceof Error ? e.message : 'Import failed.');
        },
      },
    );
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 24 }}>
        Import Schema
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* File upload */}
        <div>
          <div
            style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-secondary)', marginBottom: 8 }}
          >
            Upload JSON file
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: '2px dashed var(--border-default)',
              padding: '32px 0',
              color: 'var(--fg-tertiary)',
              cursor: 'pointer',
              transition: 'border-color 150ms',
            }}
            onClick={() => {
              fileRef.current?.click();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fileRef.current?.click();
            }}
            tabIndex={0}
            role="button"
            aria-label="Upload schema JSON file"
          >
            <span style={{ fontSize: 13 }}>Drop a JSON file here, or click to select</span>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </div>

        {/* Or paste */}
        <div>
          <label
            htmlFor="json-paste"
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--fg-secondary)',
              display: 'block',
              marginBottom: 8,
            }}
          >
            Or paste JSON
          </label>
          <textarea
            id="json-paste"
            value={jsonContent}
            onChange={(e) => {
              handlePaste(e.target.value);
            }}
            rows={8}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: 11,
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
            placeholder='{"name": "My Schema", "tables": [...]}'
            aria-label="Paste schema JSON"
          />
        </div>

        {/* Database driver */}
        <div>
          <label
            htmlFor="import-driver"
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--fg-secondary)',
              display: 'block',
              marginBottom: 8,
            }}
          >
            Target Database Driver
          </label>
          <select
            id="import-driver"
            value={driver}
            onChange={(e) => {
              setDriver(e.target.value as DatabaseDriver);
            }}
            style={{ ...inputStyle, height: 36 }}
          >
            <option value="postgres">PostgreSQL</option>
            <option value="mssql">SQL Server (MSSQL)</option>
            <option value="mongo">MongoDB</option>
          </select>
        </div>

        {/* Preview */}
        {preview && (
          <div className="pg-card" style={{ padding: '10px 16px' }}>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{preview.name}</span>
            <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--fg-secondary)' }}>
              · {preview.tables} tables
            </span>
          </div>
        )}

        {/* Error */}
        {parseError && (
          <p
            style={{
              borderRadius: 4,
              background: 'var(--bg-danger-subtle)',
              padding: '10px 12px',
              fontSize: 13,
              color: 'var(--fg-danger)',
            }}
            role="alert"
          >
            {parseError}
          </p>
        )}

        {importSchema.isError && !parseError && (
          <p
            style={{
              borderRadius: 4,
              background: 'var(--bg-danger-subtle)',
              padding: '10px 12px',
              fontSize: 13,
              color: 'var(--fg-danger)',
            }}
            role="alert"
          >
            {importSchema.error instanceof Error ? importSchema.error.message : 'Import failed.'}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="pg-btn pg-btn-secondary"
            onClick={() => {
              router.back();
            }}
          >
            Cancel
          </button>
          <button
            className="pg-btn pg-btn-primary"
            onClick={handleImport}
            disabled={!jsonContent || !!parseError || importSchema.isPending}
          >
            {importSchema.isPending ? 'Importing…' : 'Import Schema'}
          </button>
        </div>
      </div>
    </div>
  );
}
