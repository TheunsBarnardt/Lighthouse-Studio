'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { TableDefinition } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { schemaToJson } from '@/lib/schema-utils';
import { useDesignerStore } from '@/state/designer-store';

// Monaco is ~2MB; lazy-load only when this view is first opened
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
      Loading editor…
    </div>
  ),
});

export function CodeView() {
  const schema = useDesignerStore((s) => s.schema);
  const setTables = useDesignerStore((s) => s.setTables);

  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Whenever schema changes externally (e.g. Table or Diagram view edit), sync the JSON
  useEffect(() => {
    if (!schema) return;
    setJsonText(schemaToJson(schema));
    setParseError(null);
  }, [schema]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      setJsonText(value);
      setParseError(null);

      // Debounced parse — update store only when JSON is valid
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          const parsed = JSON.parse(value) as { tables?: TableDefinition[] };
          if (Array.isArray(parsed.tables)) {
            setTables(parsed.tables);
          }
        } catch (e) {
          setParseError(e instanceof Error ? e.message : 'Invalid JSON');
        }
      }, 600);
    },
    [setTables],
  );

  // Expose JSON Schema for Monaco intellisense validation
  const handleEditorMount = useCallback((_editor: unknown, monaco: unknown) => {
    type MonacoJsonApi = {
      languages: { json: { jsonDefaults: { setDiagnosticsOptions(o: unknown): void } } };
    };
    (monaco as MonacoJsonApi).languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [
        {
          uri: 'https://platform/schema/customer-schema.json',
          fileMatch: ['*'],
          schema: {
            type: 'object',
            required: ['id', 'workspaceId', 'name', 'slug', 'version', 'databaseDriver', 'tables'],
            properties: {
              id: { type: 'string' },
              workspaceId: { type: 'string' },
              name: { type: 'string', minLength: 1 },
              slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
              description: { type: 'string' },
              version: { type: 'integer', minimum: 1 },
              databaseDriver: { type: 'string', enum: ['postgres', 'mssql', 'mongo'] },
              tables: {
                type: 'array',
                items: {
                  type: 'object',
                  required: [
                    'id',
                    'name',
                    'columns',
                    'primaryKey',
                    'indexes',
                    'foreignKeys',
                    'constraints',
                  ],
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string', minLength: 1 },
                    description: { type: 'string' },
                    columns: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['id', 'name', 'type', 'nullable'],
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string', minLength: 1 },
                          nullable: { type: 'boolean' },
                          isPii: { type: 'boolean' },
                          piiCategory: {
                            type: 'string',
                            enum: [
                              'contact',
                              'identification',
                              'financial',
                              'health',
                              'behavioral',
                              'location',
                              'credential',
                              'other',
                            ],
                          },
                          description: { type: 'string' },
                          type: {
                            type: 'object',
                            required: ['kind'],
                            properties: {
                              kind: {
                                type: 'string',
                                enum: [
                                  'string',
                                  'text',
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
                                ],
                              },
                            },
                          },
                        },
                      },
                    },
                    indexes: { type: 'array' },
                    foreignKeys: { type: 'array' },
                    constraints: { type: 'array' },
                  },
                },
              },
            },
          },
        },
      ],
    });
  }, []);

  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No schema loaded.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">JSON</span>
          {parseError && (
            <span className="rounded bg-error/10 px-2 py-0.5 text-xs text-error" role="alert">
              {parseError}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const canonical = schemaToJson(schema);
            setJsonText(canonical);
            setParseError(null);
          }}
          aria-label="Format JSON"
        >
          Format
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1" aria-label="JSON schema editor">
        <MonacoEditor
          language="json"
          value={jsonText}
          onChange={handleChange}
          onMount={handleEditorMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'off',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            formatOnPaste: true,
            scrollbar: { alwaysConsumeMouseWheel: false },
          }}
        />
      </div>
    </div>
  );
}
