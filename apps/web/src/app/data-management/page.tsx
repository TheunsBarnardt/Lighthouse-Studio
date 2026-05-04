'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CreateSchemaDialog } from '@/components/schema-designer/lifecycle/create-schema-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useListSchemas } from '@/hooks/useSchemaService';

// eslint-disable-next-line no-restricted-syntax -- NEXT_PUBLIC_* vars are client-side only; getEnv() is server-only and must not be called here
const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

const DRIVER_LABEL: Record<string, string> = {
  postgres: 'PostgreSQL',
  mssql: 'SQL Server',
  mongo: 'MongoDB',
};

export default function DataManagementPage() {
  const { data, isLoading, error, refetch } = useListSchemas(DEFAULT_WORKSPACE_ID);
  const schemas = data?.items ?? [];
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Schemas</h2>
        <Button
          onClick={() => {
            setShowCreate(true);
          }}
        >
          + New Schema
        </Button>
      </div>

      {isLoading && (
        <div className="py-12 text-center text-sm text-muted-foreground" aria-live="polite">
          Loading schemas…
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error instanceof Error ? error.message : 'Failed to load schemas.'}
        </div>
      )}

      {!isLoading && !error && schemas.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground">No schemas yet. Create one to get started.</p>
          <Button
            variant="outline"
            onClick={() => {
              setShowCreate(true);
            }}
          >
            Create your first schema
          </Button>
        </div>
      )}

      {!isLoading && schemas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schemas.map((schema) => (
            <Link
              key={schema.id}
              href={`/data-management/${schema.slug}`}
              className="group rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-1 flex items-start justify-between">
                <span className="font-semibold group-hover:text-primary">{schema.name}</span>
                <Badge variant="secondary" className="ml-2 shrink-0 text-xs">
                  {DRIVER_LABEL[schema.databaseDriver] ?? schema.databaseDriver}
                </Badge>
              </div>
              {schema.description && (
                <p className="mb-2 text-sm text-muted-foreground line-clamp-2">
                  {schema.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {schema.tables.length} {schema.tables.length === 1 ? 'table' : 'tables'}
                </span>
                <span>v{schema.version}</span>
                {schema.metadata.lastDeployedAt && (
                  <span>
                    deployed {new Date(schema.metadata.lastDeployedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateSchemaDialog
        workspaceId={DEFAULT_WORKSPACE_ID}
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          void refetch();
        }}
      />
    </div>
  );
}
