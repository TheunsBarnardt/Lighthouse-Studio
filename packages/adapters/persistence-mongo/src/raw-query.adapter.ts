import type {
  ColumnMeta,
  QueryPlan,
  RawExecuteOptions,
  RawQueryPort,
  RawQueryResult,
} from '@platform/ports-persistence';
import type { Db, Document } from 'mongodb';

import { PersistenceError } from '@platform/ports-persistence';
import { err, ok, type Result } from 'neverthrow';

// ── Mongo write stages ────────────────────────────────────────────────────────

const WRITE_STAGES = new Set(['$out', '$merge']);

// ── Parameter binding for Mongo ───────────────────────────────────────────────
// Replaces $$paramName occurrences in JSON strings with bound values.

function bindMongoParams(query: string, parameters: Record<string, unknown>): string {
  return query.replace(/\$\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_match, name: string) => {
    const val = parameters[name];
    return JSON.stringify(val ?? null);
  });
}

// ── Column metadata extraction from first row ─────────────────────────────────

function inferColumns(rows: Document[]): ColumnMeta[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0] as Record<string, unknown>).map((name) => ({
    name,
    dataType: typeof (rows[0] as Record<string, unknown>)[name],
  }));
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export interface MongoRawQueryDbs {
  /** Mongo Db connected as the read-only user. */
  readonly: Db;
  /** Mongo Db connected as the console-writer user. */
  console_writer: Db;
  /**
   * Optional Mongo Db connected to a secondary replica with readPreference=secondary.
   * Used for read-only console queries to reduce load on the primary.
   */
  readonlyReplica?: Db;
}

export class MongoRawQueryAdapter implements RawQueryPort {
  constructor(private readonly dbs: MongoRawQueryDbs) {}

  private _dbFor(role: 'readonly' | 'console_writer'): Db {
    if (role === 'readonly' && this.dbs.readonlyReplica) {
      return this.dbs.readonlyReplica;
    }
    return this.dbs[role];
  }

  async execute(opts: RawExecuteOptions): Promise<Result<RawQueryResult, PersistenceError>> {
    const db = this._dbFor(opts.role);
    const start = Date.now();

    try {
      const boundQuery = bindMongoParams(opts.query, opts.parameters);
      let pipeline: Document[];
      try {
        pipeline = JSON.parse(boundQuery) as Document[];
      } catch (cause) {
        return err(
          new PersistenceError('UNKNOWN', `Invalid Mongo pipeline JSON: ${String(cause)}`, cause),
        );
      }

      // Validate no write stages when role is readonly (defense-in-depth)
      if (opts.role === 'readonly') {
        for (const stage of pipeline) {
          const stageName = Object.keys(stage)[0];
          if (stageName && WRITE_STAGES.has(stageName)) {
            return err(
              new PersistenceError(
                'PERMISSION_DENIED',
                `Write stage ${stageName} not allowed in read-only mode`,
              ),
            );
          }
        }
      }

      // Add $limit stage
      const hasLimit = pipeline.some((s) => Object.keys(s)[0] === '$limit');
      if (!hasLimit) {
        pipeline.push({ $limit: opts.rowLimit });
      }

      // Determine collection name from customerSchema prefix
      // The query body is expected to be an aggregate pipeline; collection is specified
      // via the opts.customerSchema convention: first collection in workspace
      // For now, we expect the query to come as { collection: string, pipeline: Document[] }
      // packed in opts.query (handled in the service layer).
      // The adapter itself runs against the db object using the embedded collection name.

      // The pipeline is expected to be a JSON object: { "collection": "...", "pipeline": [...] }
      // or a plain array (aggregation on a single collection passed via customerSchema).
      let collectionName: string;
      let aggPipeline: Document[];

      if (!Array.isArray(JSON.parse(opts.query) as unknown)) {
        const parsed = JSON.parse(opts.query) as { collection: string; pipeline: Document[] };
        collectionName = parsed.collection;
        const bound = bindMongoParams(JSON.stringify(parsed.pipeline), opts.parameters);
        aggPipeline = JSON.parse(bound) as Document[];
        if (!aggPipeline.some((s) => Object.keys(s)[0] === '$limit')) {
          aggPipeline.push({ $limit: opts.rowLimit });
        }
      } else {
        collectionName = opts.customerSchema;
        aggPipeline = pipeline;
      }

      const cursor = db
        .collection(collectionName)
        .aggregate(aggPipeline, { maxTimeMS: opts.timeoutMs });

      const rows = await cursor.toArray();
      const truncated = rows.length >= opts.rowLimit;

      return ok({
        rows: rows as Record<string, unknown>[],
        rowCount: rows.length,
        truncated,
        durationMs: Date.now() - start,
        columns: inferColumns(rows),
      });
    } catch (cause) {
      return err(mapMongoError(cause));
    }
  }

  async explain(opts: RawExecuteOptions): Promise<Result<QueryPlan, PersistenceError>> {
    const db = this.dbs[opts.role];
    const start = Date.now();

    try {
      let collectionName: string;
      let aggPipeline: Document[];

      const parsed = JSON.parse(opts.query) as unknown;
      if (!Array.isArray(parsed)) {
        const obj = parsed as { collection: string; pipeline: Document[] };
        collectionName = obj.collection;
        const bound = bindMongoParams(JSON.stringify(obj.pipeline), opts.parameters);
        aggPipeline = JSON.parse(bound) as Document[];
      } else {
        collectionName = opts.customerSchema;
        const bound = bindMongoParams(opts.query, opts.parameters);
        aggPipeline = JSON.parse(bound) as Document[];
      }

      const plan = await db.command({
        explain: {
          aggregate: collectionName,
          pipeline: aggPipeline,
          cursor: {},
        },
        verbosity: 'executionStats',
        maxTimeMS: opts.timeoutMs,
      });

      return ok({
        format: 'json',
        plan,
        durationMs: Date.now() - start,
      });
    } catch (cause) {
      return err(mapMongoError(cause));
    }
  }
}

// ── Error mapping ─────────────────────────────────────────────────────────────

function mapMongoError(cause: unknown): PersistenceError {
  const err_ = cause as { code?: number; codeName?: string };
  if (err_.code === 50 || err_.codeName === 'MaxTimeMSExpired') {
    return new PersistenceError('TIMEOUT', 'MongoDB query exceeded maxTimeMS', cause);
  }
  if (err_.code === 13) {
    return new PersistenceError('PERMISSION_DENIED', 'MongoDB authorization failure', cause);
  }
  return new PersistenceError('UNKNOWN', `MongoDB query failed: ${String(cause)}`, cause);
}
