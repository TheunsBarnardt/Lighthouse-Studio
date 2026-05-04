'use client';

import type { ReactNode } from 'react';

export default function SchemaLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { schemaSlug: string };
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b">
        <a
          href={`/data-management/${params.schemaSlug}`}
          className="rounded-t-lg border-b-2 border-primary px-4 py-2 font-semibold text-primary"
        >
          Editor
        </a>
        <a
          href={`/data-management/${params.schemaSlug}/api-explorer`}
          className="rounded-t-lg px-4 py-2 font-semibold text-muted-foreground hover:text-foreground"
        >
          API Explorer
        </a>
        <a
          href={`/data-management/${params.schemaSlug}/history`}
          className="rounded-t-lg px-4 py-2 font-semibold text-muted-foreground hover:text-foreground"
        >
          History
        </a>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
