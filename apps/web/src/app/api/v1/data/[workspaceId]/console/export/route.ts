import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { requestContext } from '@/lib/server/api-helpers';
import { getQueryConsoleService } from '@/lib/server/query-console-service';
import { verifySessionFromRequest } from '@/lib/server/session';

// ── POST /api/v1/data/[workspaceId]/console/export ───────────────────────────
// Synchronous CSV/JSON export for result sets up to 100,000 rows.
// When JobQueuePort (Objective 23) is available, large exports will be
// moved to a background job with a signed URL. Until then, the response
// streams the data directly — suitable for exports under ~10 MB.
//
// Body: { query, language, parameters?, format: 'csv'|'json', workspaceSlug, databaseDriver }

interface ExportBody {
  query: string;
  language: 'sql_postgres' | 'sql_mssql' | 'mongo_aggregate' | 'mongo_find';
  parameters?: Record<string, unknown>;
  format: 'csv' | 'json';
  workspaceSlug: string;
  databaseDriver: 'postgres' | 'mssql' | 'mongo';
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean | bigint);
}

function rowsToCsv(rows: Record<string, unknown>[], columns: { name: string }[]): string {
  const header = columns.map((c) => csvCell(c.name)).join(',');
  const body = rows
    .map((row) => columns.map((c) => csvCell(cellToString(row[c.name]))).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> },
): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { code: 'UNAUTHORIZED', message: 'Not authenticated.' },
      { status: 401 },
    );
  }

  const { workspaceId } = await params;
  const body = (await request.json()) as ExportBody;

  const ctx = requestContext(workspaceId, request);
  const svc = getQueryConsoleService();

  // Run the query with the maximum row limit (export bypasses default limit)
  const result = await svc.execute(ctx, {
    workspaceId,
    workspaceSlug: body.workspaceSlug,
    databaseDriver: body.databaseDriver,
    query: body.query,
    language: body.language,
    parameters: body.parameters ?? {},
    rowLimit: 100_000,
    confirmed: true,
  });

  if (result.isErr()) {
    return NextResponse.json(
      { code: result.error.code, message: result.error.message },
      { status: result.error.statusCode },
    );
  }

  const r = result.value;
  if (r.kind !== 'result') {
    return NextResponse.json(
      { code: 'CONFIRMATION_REQUIRED', message: 'Write query requires confirmation.' },
      { status: 409 },
    );
  }

  const format = body.format === 'json' ? 'json' : 'csv';
  const filename = `export-${String(Date.now())}.${format}`;

  if (format === 'json') {
    const json = JSON.stringify(
      { rows: r.rows, rowCount: r.rowCount, truncated: r.truncated },
      null,
      2,
    );
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const csv = rowsToCsv(r.rows, r.columns);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
