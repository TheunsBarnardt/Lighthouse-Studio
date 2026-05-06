/**
 * SDK data SELECT route: POST /api/v1/data/{workspace}/{schema}/{table}
 * Body: { fields?, filter?, orderBy?, limit?, offset? }
 * Returns: { data: DataRow[] }
 */
import { NextResponse } from 'next/server';

import type { DataRow } from '@/lib/server/sdk-store';

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

  // Apply filter
  if (body['filter'] && typeof body['filter'] === 'object') {
    rows = applyFilter(rows, body['filter'] as Record<string, unknown>);
  }

  // Apply field selection
  const fields = body['fields'] as string[] | undefined;
  if (fields && fields.length > 0) {
    rows = rows.map((r) => {
      const out: Partial<DataRow> = {};
      for (const f of fields) (out as Record<string, unknown>)[f] = r[f];
      return out as DataRow;
    });
  }

  // Apply orderBy, limit, offset (basic)
  const limit = typeof body['limit'] === 'number' ? body['limit'] : undefined;
  const offset = typeof body['offset'] === 'number' ? body['offset'] : 0;
  if (offset) rows = rows.slice(offset);
  if (limit !== undefined) rows = rows.slice(0, limit);

  return NextResponse.json({ data: rows });
}
