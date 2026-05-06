import type { HttpTransport } from '../transport/index.js';

// ── Filter types ──────────────────────────────────────────────────────────────

export type FilterOperator<T> = {
  _eq?: T;
  _neq?: T;
  _gt?: T;
  _gte?: T;
  _lt?: T;
  _lte?: T;
  _in?: T[];
  _nin?: T[];
  _like?: string;
  _ilike?: string;
  _is_null?: boolean;
};

export type Filter<TRow> = {
  [K in keyof TRow]?: FilterOperator<TRow[K]>;
} & {
  _and?: Filter<TRow>[];
  _or?: Filter<TRow>[];
  _not?: Filter<TRow>;
};

// ── Result types ──────────────────────────────────────────────────────────────

export interface QueryResult<TRow> {
  data: TRow[];
  count?: number;
  nextCursor?: string;
  error?: null;
}

export interface MutationResult<TRow> {
  data: TRow;
  error?: null;
}

export interface BulkResult<TRow> {
  data: TRow[];
  failed: Array<{ index: number; error: string }>;
}

// ── Builder state ─────────────────────────────────────────────────────────────

interface BuilderState<TRow> {
  table: string;
  workspace: string;
  schema: string;
  fields: (keyof TRow)[] | null;
  filter: Filter<TRow> | null;
  orderBy: Array<{ field: keyof TRow; direction: 'asc' | 'desc' }>;
  limitVal: number | null;
  offsetVal: number | null;
  cursorVal: string | null;
  withCountFlag: boolean;
  archivedMode: 'exclude' | 'include' | 'only';
}

// ── DataQueryBuilder ──────────────────────────────────────────────────────────

export class DataQueryBuilder<TRow> implements PromiseLike<QueryResult<TRow>> {
  private readonly transport: HttpTransport;
  private readonly state: BuilderState<TRow>;

  constructor(transport: HttpTransport, table: string, workspace: string, schema: string) {
    this.transport = transport;
    this.state = {
      table,
      workspace,
      schema,
      fields: null,
      filter: null,
      orderBy: [],
      limitVal: null,
      offsetVal: null,
      cursorVal: null,
      withCountFlag: false,
      archivedMode: 'exclude',
    };
  }

  // ── Chain methods ─────────────────────────────────────────────────────────

  select<K extends keyof TRow>(...fields: K[]): DataQueryBuilder<Pick<TRow, K>> {
    return this.clone({ fields }) as unknown as DataQueryBuilder<Pick<TRow, K>>;
  }

  where(filter: Filter<TRow>): this {
    return this.clone({ filter }) as this;
  }

  orderBy(field: keyof TRow, direction: 'asc' | 'desc' = 'asc'): this {
    return this.clone({ orderBy: [...this.state.orderBy, { field, direction }] }) as this;
  }

  limit(n: number): this {
    return this.clone({ limitVal: n }) as this;
  }

  offset(n: number): this {
    return this.clone({ offsetVal: n }) as this;
  }

  cursor(c: string): this {
    return this.clone({ cursorVal: c }) as this;
  }

  withCount(): this {
    return this.clone({ withCountFlag: true }) as this;
  }

  archived(mode: 'only' | 'include' | 'exclude'): this {
    return this.clone({ archivedMode: mode }) as this;
  }

  // ── Termination (promise-like) ─────────────────────────────────────────────

  then<TResult1 = QueryResult<TRow>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<TRow>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute(): Promise<QueryResult<TRow>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}`;
    return this.transport.request<QueryResult<TRow>>({
      path,
      body: this.buildRequestBody(),
      method: 'POST',
      noIdempotency: true,
    });
  }

  private buildRequestBody() {
    return {
      fields: this.state.fields,
      filter: this.state.filter,
      orderBy: this.state.orderBy.length ? this.state.orderBy : undefined,
      limit: this.state.limitVal,
      offset: this.state.offsetVal,
      cursor: this.state.cursorVal,
      withCount: this.state.withCountFlag || undefined,
      archived: this.state.archivedMode !== 'exclude' ? this.state.archivedMode : undefined,
    };
  }

  // ── Single-row helpers ─────────────────────────────────────────────────────

  async first(): Promise<TRow | null> {
    const result = await this.clone({ limitVal: 1 }).execute();
    return result.data[0] ?? null;
  }

  async one(): Promise<TRow> {
    const result = await this.execute();
    if (result.data.length === 0)
      throw new Error(`Expected one row from ${this.state.table}, got 0`);
    if (result.data.length > 1)
      throw new Error(
        `Expected one row from ${this.state.table}, got ${String(result.data.length)}`,
      );
    return result.data[0] as TRow;
  }

  async count(): Promise<number> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/count`;
    const result = await this.transport.request<{ count: number }>({
      path,
      body: { filter: this.state.filter },
      method: 'POST',
      noIdempotency: true,
    });
    return result.count;
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async insert(record: Partial<TRow> | Partial<TRow>[]): Promise<MutationResult<TRow>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/insert`;
    return this.transport.request({ method: 'POST', path, body: { record } });
  }

  async update(changes: Partial<TRow>): Promise<MutationResult<TRow>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/update`;
    return this.transport.request({
      method: 'POST',
      path,
      body: { filter: this.state.filter, changes },
    });
  }

  async upsert(
    record: Partial<TRow>,
    conflict: keyof TRow | (keyof TRow)[],
  ): Promise<MutationResult<TRow>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/upsert`;
    return this.transport.request({ method: 'POST', path, body: { record, conflict } });
  }

  async delete(): Promise<MutationResult<void>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/delete`;
    return this.transport.request({ method: 'POST', path, body: { filter: this.state.filter } });
  }

  async archive(): Promise<MutationResult<void>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/archive`;
    return this.transport.request({ method: 'POST', path, body: { filter: this.state.filter } });
  }

  async restore(): Promise<MutationResult<void>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/restore`;
    return this.transport.request({ method: 'POST', path, body: { filter: this.state.filter } });
  }

  async hardDelete(): Promise<MutationResult<void>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/hard-delete`;
    return this.transport.request({ method: 'POST', path, body: { filter: this.state.filter } });
  }

  // ── Bulk ──────────────────────────────────────────────────────────────────

  async bulkInsert(records: Partial<TRow>[]): Promise<BulkResult<TRow>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/bulk-insert`;
    return this.transport.request({ method: 'POST', path, body: { records } });
  }

  async bulkUpdate(changes: Partial<TRow>): Promise<BulkResult<void>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/bulk-update`;
    return this.transport.request({
      method: 'POST',
      path,
      body: { filter: this.state.filter, changes },
    });
  }

  async bulkDelete(): Promise<BulkResult<void>> {
    const path = `/api/v1/data/${this.state.workspace}/${this.state.schema}/${this.state.table}/bulk-delete`;
    return this.transport.request({ method: 'POST', path, body: { filter: this.state.filter } });
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private clone(overrides: Partial<BuilderState<TRow>>): DataQueryBuilder<TRow> {
    const next = new DataQueryBuilder<TRow>(
      this.transport,
      this.state.table,
      this.state.workspace,
      this.state.schema,
    );
    Object.assign(next.state, { ...this.state, ...overrides });
    return next;
  }
}
