import type { LoggerPort, TracerPort } from '@platform/ports-observability';
import type { Db } from 'mongodb';
import type { Result } from 'neverthrow';

import {
  PersistenceError,
  type Page,
  type PaginatedResult,
  type QueryPort,
} from '@platform/ports-persistence';
import { err, ok } from 'neverthrow';

type QueryFn<TResult, TParams extends Record<string, unknown>> = (
  params: TParams,
  page: Page,
  db: Db,
) => Promise<PaginatedResult<TResult>>;

type QueryOneFn<TResult, TParams extends Record<string, unknown>> = (
  params: TParams,
  db: Db,
) => Promise<TResult | null>;

export class MongoQueryAdapter implements QueryPort {
  private readonly queries = new Map<string, QueryFn<unknown, Record<string, unknown>>>();
  private readonly queryOnes = new Map<string, QueryOneFn<unknown, Record<string, unknown>>>();

  constructor(
    private readonly db: Db,
    private readonly logger?: LoggerPort,
    private readonly tracer?: TracerPort,
  ) {}

  register<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    name: string,
    fn: QueryFn<TResult, TParams>,
  ): this {
    this.queries.set(name, fn as QueryFn<unknown, Record<string, unknown>>);
    return this;
  }

  registerOne<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    name: string,
    fn: QueryOneFn<TResult, TParams>,
  ): this {
    this.queryOnes.set(name, fn as QueryOneFn<unknown, Record<string, unknown>>);
    return this;
  }

  async query<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    queryName: string,
    params?: TParams,
    page?: Page,
  ): Promise<Result<PaginatedResult<TResult>, PersistenceError>> {
    const fn = this.queries.get(queryName);
    if (!fn) return err(new PersistenceError('UNKNOWN', `Unknown query: "${queryName}"`));
    const effectivePage = page ?? { limit: 100, offset: 0 };
    const run = async (): Promise<Result<PaginatedResult<TResult>, PersistenceError>> => {
      const start = Date.now();
      try {
        const result = await fn(params ?? {}, effectivePage, this.db);
        this.logger?.debug('MongoDB query executed', {
          queryName,
          elapsed_ms: Date.now() - start,
        });
        return ok(result as PaginatedResult<TResult>);
      } catch (e) {
        return err(new PersistenceError('UNKNOWN', `Query "${queryName}" failed: ${String(e)}`, e));
      }
    };
    if (this.tracer) return this.tracer.withSpan(`db.query.${queryName}`, run);
    return run();
  }

  async queryOne<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    queryName: string,
    params?: TParams,
  ): Promise<Result<TResult | null, PersistenceError>> {
    const fn = this.queryOnes.get(queryName);
    if (!fn) return err(new PersistenceError('UNKNOWN', `Unknown query: "${queryName}"`));
    const run = async (): Promise<Result<TResult | null, PersistenceError>> => {
      const start = Date.now();
      try {
        const result = await fn(params ?? {}, this.db);
        this.logger?.debug('MongoDB queryOne executed', {
          queryName,
          elapsed_ms: Date.now() - start,
        });
        return ok(result as TResult | null);
      } catch (e) {
        return err(
          new PersistenceError('UNKNOWN', `QueryOne "${queryName}" failed: ${String(e)}`, e),
        );
      }
    };
    if (this.tracer) return this.tracer.withSpan(`db.queryOne.${queryName}`, run);
    return run();
  }
}
