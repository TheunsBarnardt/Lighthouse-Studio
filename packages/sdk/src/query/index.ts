import type { HttpTransport } from '../transport/index.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QueryResultRow {
  [key: string]: unknown;
}

export interface SqlQueryResult {
  rows: QueryResultRow[];
  rowCount: number;
  columns: Array<{ name: string; type: string }>;
  durationMs: number;
}

export interface QueryPlan {
  plan: unknown;
  estimatedCost: number;
}

export interface SaveQueryInput {
  name: string;
  sql: string;
  parameters?: Record<string, unknown>;
  description?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  parameters: Record<string, unknown> | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── QueryClient ───────────────────────────────────────────────────────────────

export class QueryClient {
  constructor(
    private readonly transport: HttpTransport,
    private readonly workspace: string,
    private readonly schema: string,
  ) {}

  async execute(sql: string, parameters?: Record<string, unknown>): Promise<SqlQueryResult> {
    return this.transport.request({
      method: 'POST',
      path: `/api/v1/query/${this.workspace}/${this.schema}/execute`,
      body: { sql, parameters },
      noIdempotency: true,
    });
  }

  async explain(sql: string, parameters?: Record<string, unknown>): Promise<QueryPlan> {
    return this.transport.request({
      method: 'POST',
      path: `/api/v1/query/${this.workspace}/${this.schema}/explain`,
      body: { sql, parameters },
      noIdempotency: true,
    });
  }

  async saveQuery(input: SaveQueryInput): Promise<SavedQuery> {
    return this.transport.request({
      method: 'POST',
      path: `/api/v1/query/${this.workspace}/${this.schema}/saved`,
      body: input,
    });
  }

  async listSaved(): Promise<SavedQuery[]> {
    return this.transport.request({
      path: `/api/v1/query/${this.workspace}/${this.schema}/saved`,
    });
  }
}
