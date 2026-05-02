import type { LoggerPort, TracerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

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
  pool: Pool,
) => Promise<PaginatedResult<TResult>>;

type QueryOneFn<TResult, TParams extends Record<string, unknown>> = (
  params: TParams,
  pool: Pool,
) => Promise<TResult | null>;

export class PostgresQueryAdapter implements QueryPort {
  private readonly queries = new Map<string, QueryFn<unknown, Record<string, unknown>>>();
  private readonly queryOnes = new Map<string, QueryOneFn<unknown, Record<string, unknown>>>();

  constructor(
    private readonly pool: Pool,
    private readonly logger?: LoggerPort,
    private readonly tracer?: TracerPort,
  ) {}

  /**
   * Register a named many-row query.
   * The implementation receives the raw pg pool and is responsible for parameterisation.
   */
  register<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    name: string,
    fn: QueryFn<TResult, TParams>,
  ): this {
    this.queries.set(name, fn as QueryFn<unknown, Record<string, unknown>>);
    return this;
  }

  /**
   * Register a named single-row query.
   */
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
    if (!fn) {
      return err(new PersistenceError('UNKNOWN', `Unknown query: "${queryName}"`));
    }

    const effectivePage = page ?? { limit: 100, offset: 0 };

    const run = async (): Promise<Result<PaginatedResult<TResult>, PersistenceError>> => {
      const start = Date.now();
      try {
        const result = await fn(params ?? {}, effectivePage, this.pool);
        const elapsed = Date.now() - start;
        this.logger?.debug('Query executed', { queryName, elapsed_ms: elapsed });
        return ok(result as PaginatedResult<TResult>);
      } catch (e) {
        return err(new PersistenceError('UNKNOWN', `Query "${queryName}" failed: ${String(e)}`, e));
      }
    };

    if (this.tracer) {
      return this.tracer.withSpan(`db.query.${queryName}`, run);
    }
    return run();
  }

  async queryOne<TResult, TParams extends Record<string, unknown> = Record<string, never>>(
    queryName: string,
    params?: TParams,
  ): Promise<Result<TResult | null, PersistenceError>> {
    const fn = this.queryOnes.get(queryName);
    if (!fn) {
      return err(new PersistenceError('UNKNOWN', `Unknown query: "${queryName}"`));
    }

    const run = async (): Promise<Result<TResult | null, PersistenceError>> => {
      const start = Date.now();
      try {
        const result = await fn(params ?? {}, this.pool);
        const elapsed = Date.now() - start;
        this.logger?.debug('QueryOne executed', { queryName, elapsed_ms: elapsed });
        return ok(result as TResult | null);
      } catch (e) {
        return err(
          new PersistenceError('UNKNOWN', `QueryOne "${queryName}" failed: ${String(e)}`, e),
        );
      }
    };

    if (this.tracer) {
      return this.tracer.withSpan(`db.queryOne.${queryName}`, run);
    }
    return run();
  }
}
