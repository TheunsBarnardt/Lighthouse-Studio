/**
 * SDK data UPDATE route: POST /api/v1/data/{workspace}/{schema}/{table}/update
 * Body: { filter: object, changes: object }
 * Returns: { data: DataRow } on success
 * Returns 409 VERSION_MISMATCH if changes.version doesn't match current version
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
  if (body['filter']) {
    rows = applyFilter(rows, body['filter'] as Record<string, unknown>);
  }

  const changes = (body['changes'] ?? {}) as Record<string, unknown>;
  const requestedVersion = typeof changes['version'] === 'number' ? changes['version'] : undefined;

  const updated: DataRow[] = [];
  for (const row of rows) {
    if (requestedVersion !== undefined && row['version'] !== requestedVersion) {
      return NextResponse.json(
        { code: 'VERSION_MISMATCH', message: 'Optimistic lock conflict', statusCode: 409 },
        { status: 409 },
      );
    }
    const { version: _v, ...restChanges } = changes;
    const newRow: DataRow = {
      ...row,
      ...restChanges,
      version: row['version'] + 1,
      updated_at: new Date().toISOString(),
    };
    tableStore.set(row.id, newRow);
    updated.push(newRow);
  }

  return NextResponse.json({ data: updated.length === 1 ? updated[0] : updated });
}
