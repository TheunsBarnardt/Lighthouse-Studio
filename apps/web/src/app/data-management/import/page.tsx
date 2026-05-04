'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import type { CustomerSchema, DatabaseDriver } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useImportSchema } from '@/hooks/useSchemaService';

// eslint-disable-next-line no-restricted-syntax
const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

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
    <div className="mx-auto max-w-2xl py-8">
      <h2 className="mb-6 text-xl font-semibold">Import Schema</h2>

      <div className="space-y-6">
        {/* File upload */}
        <div>
          <Label className="mb-2 block text-sm font-medium">Upload JSON file</Label>
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-8 text-muted-foreground transition-colors hover:border-primary/40"
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
            <span className="text-sm">Drop a JSON file here, or click to select</span>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
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
          <Label htmlFor="json-paste" className="mb-2 block text-sm font-medium">
            Or paste JSON
          </Label>
          <textarea
            id="json-paste"
            value={jsonContent}
            onChange={(e) => {
              handlePaste(e.target.value);
            }}
            rows={8}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder='{"name": "My Schema", "tables": [...]}'
            aria-label="Paste schema JSON"
          />
        </div>

        {/* Database driver */}
        <div>
          <Label htmlFor="import-driver" className="mb-1 block text-sm font-medium">
            Target Database Driver
          </Label>
          <Select
            id="import-driver"
            value={driver}
            onChange={(e) => {
              setDriver(e.target.value as DatabaseDriver);
            }}
          >
            <option value="postgres">PostgreSQL</option>
            <option value="mssql">SQL Server (MSSQL)</option>
            <option value="mongo">MongoDB</option>
          </Select>
        </div>

        {/* Preview */}
        {preview && (
          <div className="rounded-lg border bg-card px-4 py-3 text-sm">
            <span className="font-medium">{preview.name}</span>
            <span className="ml-2 text-muted-foreground">· {preview.tables} tables</span>
          </div>
        )}

        {/* Error */}
        {parseError && (
          <p className="rounded bg-error/10 px-3 py-2 text-sm text-error" role="alert">
            {parseError}
          </p>
        )}

        {importSchema.isError && !parseError && (
          <p className="rounded bg-error/10 px-3 py-2 text-sm text-error" role="alert">
            {importSchema.error instanceof Error ? importSchema.error.message : 'Import failed.'}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              router.back();
            }}
          >
            Cancel
          </Button>
          <Button
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
