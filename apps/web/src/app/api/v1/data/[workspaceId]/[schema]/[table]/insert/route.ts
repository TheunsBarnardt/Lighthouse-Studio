/**
 * SDK data INSERT route: POST /api/v1/data/{workspace}/{schema}/{table}/insert
 * Body: { record: object | object[] }
 * Returns: { data: DataRow | DataRow[] }
 */
import { NextResponse } from 'next/server';

import { getTable } from '@/lib/server/sdk-store';

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
  const now = new Date().toISOString();
  const records = Array.isArray(body['record']) ? body['record'] : [body['record'] ?? {}];

  const inserted = (records as Record<string, unknown>[]).map((rec) => {
    const row = {
      ...rec,
      id: crypto.randomUUID(),
      version: 1,
      created_at: now,
      updated_at: now,
    };
    tableStore.set(row.id, row);
    return row;
  });

  const result = inserted.length === 1 ? inserted[0] : inserted;
  return NextResponse.json({ data: result });
}
