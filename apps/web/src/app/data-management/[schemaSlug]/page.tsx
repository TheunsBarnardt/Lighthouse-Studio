'use client';

import { useParams } from 'next/navigation';

import { SchemaDesigner } from '@/components/schema-designer/schema-designer';

// eslint-disable-next-line no-restricted-syntax -- NEXT_PUBLIC_* vars are client-side only; getEnv() is server-only
const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

export default function SchemaEditorPage() {
  const params = useParams<{ schemaSlug: string }>();

  return (
    <div className="h-[calc(100vh-120px)]">
      <SchemaDesigner workspaceId={DEFAULT_WORKSPACE_ID} schemaId={params.schemaSlug} />
    </div>
  );
}
