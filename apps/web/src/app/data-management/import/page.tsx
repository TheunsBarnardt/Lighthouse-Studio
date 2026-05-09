'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { CustomerSchema, DatabaseDriver } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { useImportSchema } from '@/hooks/useSchemaService';

// eslint-disable-next-line no-restricted-syntax
const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

const inputStyle = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
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
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Import Schema</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* File upload */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Upload JSON file</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: '2px dashed var(--border-default)',
              padding: '32px 0',
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
          <div
            className="rounded-md border bg-card text-card-foreground p-4"
            style={{ padding: '10px 16px' }}
          >
            <span style={{ fontWeight: 500, fontSize: 13 }}>{preview.name}</span>
            <span style={{ marginLeft: 8, fontSize: 13 }}>· {preview.tables} tables</span>
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
            }}
            role="alert"
          >
            {importSchema.error instanceof Error ? importSchema.error.message : 'Import failed.'}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            variant="outline"
            type="button"
            onClick={() => {
              router.back();
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!jsonContent || !!parseError || importSchema.isPending}
          >
            {importSchema.isPending ? 'Importing…' : 'Import Schema'}
          </Button>
        </div>
      </div>
    </div>
  );
}
