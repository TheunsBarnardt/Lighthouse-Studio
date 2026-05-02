import type {
  FullTextSearchOptions,
  FullTextSearchPort,
  SearchResult,
} from '@platform/ports-search';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

import { SearchError } from '@platform/ports-search';
import { err, ok } from 'neverthrow';

/**
 * Postgres full-text search adapter.
 *
 * Expects indexed tables to have a `_search tsvector` column populated by a trigger
 * or a GENERATED ALWAYS AS expression. The Data Management module generates this DDL
 * when a table is registered for FTS.
 *
 * For platform-internal tables (artifacts, audit events, project metadata),
 * the column is created by the relevant domain migration.
 *
 * Storage schema for indexed documents (used when table is not a platform entity):
 *   __fts_<indexName> (id UUID, payload JSONB, _search TSVECTOR GENERATED ALWAYS AS ...)
 */
export class PostgresFullTextSearchAdapter implements FullTextSearchPort {
  constructor(private readonly pool: Pool) {}

  async index(
    indexName: string,
    id: string,
    document: Record<string, unknown>,
  ): Promise<Result<void, SearchError>> {
    const tableName = `__fts_${indexName}`;
    const payload = JSON.stringify(document);

    try {
      // Ensure the index table exists (idempotent)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id      UUID    PRIMARY KEY,
          payload JSONB   NOT NULL,
          _search TSVECTOR GENERATED ALWAYS AS (
            to_tsvector('english', payload::text)
          ) STORED
        )
      `);

      await this.pool.query(
        `INSERT INTO "${tableName}" (id, payload) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
        [id, payload],
      );

      return ok(undefined);
    } catch (e) {
      return err(new SearchError('PROVIDER_ERROR', `FTS index failed: ${String(e)}`, e));
    }
  }

  async delete(indexName: string, id: string): Promise<Result<void, SearchError>> {
    const tableName = `__fts_${indexName}`;
    try {
      await this.pool.query(`DELETE FROM "${tableName}" WHERE id = $1`, [id]);
      return ok(undefined);
    } catch (e) {
      return err(new SearchError('PROVIDER_ERROR', `FTS delete failed: ${String(e)}`, e));
    }
  }

  async search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    opts?: FullTextSearchOptions,
  ): Promise<Result<SearchResult<T>, SearchError>> {
    const tableName = `__fts_${indexName}`;
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;

    try {
      const start = Date.now();

      const res = await this.pool.query<{ id: string; payload: T; rank: number; total: bigint }>(
        `SELECT
           id,
           payload,
           ts_rank(_search, plainto_tsquery('english', $1)) AS rank,
           COUNT(*) OVER () AS total
         FROM "${tableName}"
         WHERE _search @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC
         LIMIT $2 OFFSET $3`,
        [query, limit, offset],
      );

      const took = Date.now() - start;
      const total = res.rows.length > 0 ? Number(res.rows[0]?.total ?? 0) : 0;

      return ok({
        items: res.rows.map(
          (r) => ({ ...r.payload, _score: Number(r.rank) }) as T & { _score: number },
        ),
        total,
        took,
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === '42P01') {
        return err(new SearchError('INDEX_NOT_FOUND', `Index "${indexName}" not found`));
      }
      return err(new SearchError('QUERY_FAILED', `FTS search failed: ${String(e)}`, e));
    }
  }

  async deleteIndex(indexName: string): Promise<Result<void, SearchError>> {
    const tableName = `__fts_${indexName}`;
    try {
      await this.pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
      return ok(undefined);
    } catch (e) {
      return err(new SearchError('PROVIDER_ERROR', `deleteIndex failed: ${String(e)}`, e));
    }
  }
}
