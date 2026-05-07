/**
 * SDK data DELETE route: POST /api/v1/data/{workspace}/{schema}/{table}/delete
 * Body: { filter: object }
 * Returns: { data: null }
 */
import { NextResponse } from 'next/server';

import { applyFilter, getTable } from '@/lib/server/sdk-store';

interface Params {
  workspaceId: string;
  schema: string;
  table: string;
}

export async function POST(
  request: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { workspaceId, schema, table } = params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  const tableStore = getTable(workspaceId, schema, table);
  let rows = Array.from(tableStore.values());
  if (body['filter']) {
    rows = applyFilter(rows, body['filter'] as Record<string, unknown>);
  }

  for (const row of rows) tableStore.delete(row.id);

  return NextResponse.json({ data: null });
}
