/**
 * SDK query execute route: POST /api/v1/query/{workspace}/{schema}/execute
 * Body: { sql: string }
 * Returns: { rows: unknown[] }
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, no-restricted-syntax */
// @ts-expect-error -- mssql ships its own types but they are not picked up correctly in strict mode
import mssql from 'mssql';
import { NextResponse } from 'next/server';

interface Params {
  workspaceId: string;
  schema: string;
}

const g = globalThis as typeof globalThis & { _sdkQueryPool?: mssql.ConnectionPool };

async function getPool(): Promise<mssql.ConnectionPool> {
  if (g._sdkQueryPool?.connected) return g._sdkQueryPool;
  const pool = await mssql.connect({
    server: process.env['MSSQL_SERVER'] ?? 'localhost',
    port: parseInt(process.env['MSSQL_PORT'] ?? '1433', 10),
    database: process.env['MSSQL_DATABASE'] ?? 'platform_dev',
    user: process.env['MSSQL_USER'],
    password: process.env['MSSQL_PASSWORD'],
    options: {
      encrypt: process.env['MSSQL_ENCRYPT'] === 'true',
      trustServerCertificate: process.env['MSSQL_TRUST_SERVER_CERTIFICATE'] !== 'false',
    },
  });
  g._sdkQueryPool = pool;
  return pool;
}

export async function POST(
  request: Request,
  { params: _params }: { params: Params },
): Promise<NextResponse> {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  const sql = typeof body['sql'] === 'string' ? body['sql'] : '';
  if (!sql.trim()) {
    return NextResponse.json({ code: 'VALIDATION', message: 'sql is required' }, { status: 400 });
  }

  try {
    const pool = await getPool();
    const result = await pool.request().query(sql);
    return NextResponse.json({ rows: result.recordset ?? [] });
  } catch (err) {
    return NextResponse.json(
      {
        code: 'QUERY_ERROR',
        message: String(err instanceof Error ? err.message : err),
        statusCode: 500,
      },
      { status: 500 },
    );
  }
}
