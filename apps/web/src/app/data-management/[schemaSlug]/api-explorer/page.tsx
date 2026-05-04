'use client';
/* eslint-disable no-restricted-syntax */
import { useParams } from 'next/navigation';

const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

export default function ApiExplorerPage() {
  const params = useParams<{ schemaSlug: string }>();
  const openApiUrl = `/api/v1/data/${DEFAULT_WORKSPACE_ID}/openapi.json?schemaSlug=${params.schemaSlug}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">API Explorer</h2>
        <a
          href={openApiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline hover:no-underline"
        >
          View OpenAPI spec
        </a>
      </div>

      <div
        className="flex min-h-[400px] items-center justify-center rounded-lg border bg-card p-8 text-muted-foreground"
        aria-label="API explorer"
      >
        <div className="text-center">
          <p className="text-base font-medium">API Explorer</p>
          <p className="mt-2 text-sm">Available once the REST API (Objective 12) is deployed.</p>
          <a
            href={openApiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm text-primary underline"
          >
            Try loading OpenAPI spec →
          </a>
        </div>
      </div>
    </div>
  );
}
