import type {
  VectorPoint,
  VectorSearchOptions,
  VectorSearchResult,
  VectorStorePort,
} from '@platform/ports-search';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

import { SearchError } from '@platform/ports-search';
import { err, ok } from 'neverthrow';

/**
 * Postgres vector store adapter backed by pgvector.
 *
 * Requires the `vector` extension (included in the pgvector/pgvector Docker image).
 * If the extension is not installed, all operations return a NOT_SUPPORTED error.
 *
 * Collections are stored as individual Postgres tables with a `vector(N)` embedding column.
 * Table name: __vec_<collectionName>
 */
export class PostgresVectorStoreAdapter implements VectorStorePort {
  private pgvectorAvailable: boolean | undefined;

  constructor(private readonly pool: Pool) {}

  private async checkExtension(): Promise<boolean> {
    if (this.pgvectorAvailable !== undefined) return this.pgvectorAvailable;
    try {
      const res = await this.pool.query(
        `SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1`,
      );
      this.pgvectorAvailable = (res.rowCount ?? 0) > 0;
    } catch {
      this.pgvectorAvailable = false;
    }
    return this.pgvectorAvailable;
  }

  async createCollection(
    collectionName: string,
    dimensions: number,
  ): Promise<Result<void, SearchError>> {
    if (!(await this.checkExtension())) {
      return err(new SearchError('NOT_SUPPORTED', 'pgvector extension is not installed'));
    }

    const tableName = `__vec_${collectionName}`;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}" (
          id      UUID    PRIMARY KEY,
          vector  vector(${String(dimensions)}) NOT NULL,
          payload JSONB   NOT NULL DEFAULT '{}'
        )
      `);
      // HNSW index for approximate nearest-neighbour search
      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS "${tableName}_hnsw_idx"
        ON "${tableName}"
        USING hnsw (vector vector_cosine_ops)
      `);
      return ok(undefined);
    } catch (e) {
      return err(new SearchError('PROVIDER_ERROR', `createCollection failed: ${String(e)}`, e));
    }
  }

  async deleteCollection(collectionName: string): Promise<Result<void, SearchError>> {
    const tableName = `__vec_${collectionName}`;
    try {
      await this.pool.query(`DROP TABLE IF EXISTS "${tableName}"`);
      return ok(undefined);
    } catch (e) {
      return err(new SearchError('PROVIDER_ERROR', `deleteCollection failed: ${String(e)}`, e));
    }
  }

  async upsert(collectionName: string, points: VectorPoint[]): Promise<Result<void, SearchError>> {
    if (!(await this.checkExtension())) {
      return err(new SearchError('NOT_SUPPORTED', 'pgvector extension is not installed'));
    }
    if (points.length === 0) return ok(undefined);

    const tableName = `__vec_${collectionName}`;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const point of points) {
        const vectorLiteral = `[${point.vector.join(',')}]`;
        await client.query(
          `INSERT INTO "${tableName}" (id, vector, payload) VALUES ($1, $2::vector, $3)
           ON CONFLICT (id) DO UPDATE SET vector = EXCLUDED.vector, payload = EXCLUDED.payload`,
          [point.id, vectorLiteral, JSON.stringify(point.payload ?? {})],
        );
      }
      await client.query('COMMIT');
      return ok(undefined);
    } catch (e) {
      await client.query('ROLLBACK');
      return err(new SearchError('PROVIDER_ERROR', `upsert failed: ${String(e)}`, e));
    } finally {
      client.release();
    }
  }

  async search(
    collectionName: string,
    vector: number[],
    opts?: VectorSearchOptions,
  ): Promise<Result<VectorSearchResult<Record<string, unknown>>, SearchError>> {
    if (!(await this.checkExtension())) {
      return err(new SearchError('NOT_SUPPORTED', 'pgvector extension is not installed'));
    }

    const tableName = `__vec_${collectionName}`;
    const limit = opts?.limit ?? 10;
    const threshold = opts?.scoreThreshold;
    const vectorLiteral = `[${vector.join(',')}]`;

    try {
      let sql = `
        SELECT id, payload, 1 - (vector <=> $1::vector) AS similarity
        FROM "${tableName}"
      `;
      const params: unknown[] = [vectorLiteral];

      if (threshold !== undefined) {
        params.push(1 - threshold); // cosine distance threshold
        sql += ` WHERE (vector <=> $1::vector) <= $${String(params.length)}`;
      }

      params.push(limit);
      sql += ` ORDER BY vector <=> $1::vector LIMIT $${String(params.length)}`;

      const res = await this.pool.query<{
        id: string;
        payload: Record<string, unknown>;
        similarity: number;
      }>(sql, params);

      return ok({
        items: res.rows.map((r) => ({
          ...r.payload,
          id: r.id,
          _distance: 1 - Number(r.similarity),
        })),
        total: res.rows.length,
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === '42P01') {
        return err(new SearchError('INDEX_NOT_FOUND', `Collection "${collectionName}" not found`));
      }
      return err(new SearchError('QUERY_FAILED', `Vector search failed: ${String(e)}`, e));
    }
  }

  async delete(collectionName: string, ids: string[]): Promise<Result<void, SearchError>> {
    if (ids.length === 0) return ok(undefined);

    const tableName = `__vec_${collectionName}`;
    try {
      await this.pool.query(`DELETE FROM "${tableName}" WHERE id = ANY($1)`, [ids]);
      return ok(undefined);
    } catch (e) {
      return err(new SearchError('PROVIDER_ERROR', `delete failed: ${String(e)}`, e));
    }
  }
}
