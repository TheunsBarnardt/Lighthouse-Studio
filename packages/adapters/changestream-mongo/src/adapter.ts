import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type {
  ChangeEvent,
  ChangeStreamCapabilities,
  ChangeStreamPort,
  SubscribeOptions,
} from '@platform/ports-persistence';
import type { ChangeStream, ChangeStreamDocument, Db, Document } from 'mongodb';

// eslint-disable-next-line no-restricted-imports -- shared fanout utility for changestream adapters only
import { ChangeStreamFanout } from '@platform/adapter-changestream-shared';

// ── Config ────────────────────────────────────────────────────────────────────

export interface MongoChangeStreamConfig {
  /**
   * Collections to watch. Pass an empty array or omit to watch the entire database.
   * Corresponds to the 'tables' abstraction.
   */
  collections?: string[];
  /** maxTimeMS for the change stream cursor. Defaults to no timeout (continuous). */
  maxAwaitTimeMs?: number;
  /** Buffer size per subscriber. Defaults to 1 000. */
  bufferSize?: number;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

let globalSeq = BigInt(0);
function nextSeq(): bigint {
  globalSeq += BigInt(1);
  return globalSeq;
}

function mapMongoEvent(event: ChangeStreamDocument, seq: bigint): ChangeEvent | null {
  const detectedAt = new Date();
  const resumeToken = JSON.stringify(event._id);
  const ns = 'ns' in event ? (event.ns as { db: string; coll?: string }) : null;
  const table = ns?.coll ?? 'unknown';
  const rowId =
    'documentKey' in event ? ((event.documentKey as unknown as { _id?: string })._id ?? '') : '';

  switch (event.operationType) {
    case 'insert':
      return {
        kind: 'insert',
        sequenceNumber: seq,
        detectedAt,
        resumeToken,
        table,
        rowId,
        after: (event.fullDocument as Record<string, unknown> | undefined) ?? null,
      };
    case 'update':
    case 'replace':
      return {
        kind: 'update',
        sequenceNumber: seq,
        detectedAt,
        resumeToken,
        table,
        rowId,
        before: null, // MongoDB change streams don't include before-image by default
        after: (event.fullDocument as Record<string, unknown> | undefined) ?? {},
      };
    case 'delete':
      return {
        kind: 'delete',
        sequenceNumber: seq,
        detectedAt,
        resumeToken,
        table,
        rowId,
        before: null,
      };
    case 'drop':
    case 'rename':
    case 'dropDatabase':
    case 'invalidate':
      return {
        kind: 'schema_change',
        sequenceNumber: seq,
        detectedAt,
        resumeToken,
        table,
        description: `MongoDB operation: ${event.operationType}`,
      };
    default:
      return null;
  }
}

export class MongoChangeStreamAdapter implements ChangeStreamPort {
  private readonly fanout: ChangeStreamFanout;
  private changeStream: ChangeStream | null = null;
  private started = false;

  constructor(
    private readonly db: Db,
    private readonly config: MongoChangeStreamConfig = {},
    private readonly deps?: { logger?: LoggerPort; metrics?: MetricsPort },
  ) {
    this.fanout = new ChangeStreamFanout(deps);
  }

  capabilities(): ChangeStreamCapabilities {
    return {
      beforeImages: false,
      sourceFiltering: true,
      resumable: true,
      prerequisites: [
        'MongoDB must be running as a replica set (even single-node)',
        'readPreference must allow oplog access',
        'MongoDB 4.0+ required for multi-collection watch',
      ],
    };
  }

  subscribe(opts: SubscribeOptions = {}): AsyncIterable<ChangeEvent> {
    if (!this.started) {
      this.started = true;
      this.startStream(opts.resumeToken);
    }
    return this.fanout.createSubscription(opts);
  }

  async close(): Promise<void> {
    this.fanout.close();
    if (this.changeStream) {
      await this.changeStream.close();
      this.changeStream = null;
    }
    this.deps?.logger?.info('MongoDB change stream adapter closed');
  }

  private startStream(resumeToken?: string): void {
    const pipeline: Document[] = [];

    // Source-side filtering by collection
    if (this.config.collections && this.config.collections.length > 0) {
      pipeline.push({
        $match: {
          'ns.coll': { $in: this.config.collections },
        },
      });
    }

    // Request full document on update so we have the after-image
    pipeline.push({
      $match: {
        operationType: { $in: ['insert', 'update', 'replace', 'delete', 'drop', 'rename'] },
      },
    });

    const streamOptions: {
      fullDocument: 'updateLookup';
      startAfter?: unknown;
      maxAwaitTimeMS?: number;
    } = {
      fullDocument: 'updateLookup',
      ...(resumeToken ? { startAfter: JSON.parse(resumeToken) as unknown } : {}),
      ...(this.config.maxAwaitTimeMs ? { maxAwaitTimeMS: this.config.maxAwaitTimeMs } : {}),
    };

    const stream: ChangeStream = this.db.watch(pipeline, streamOptions);
    this.changeStream = stream;

    stream.on('change', (event: ChangeStreamDocument) => {
      const mapped = mapMongoEvent(event, nextSeq());
      if (mapped) this.fanout.publish(mapped);
    });

    stream.on('error', (err: Error) => {
      this.deps?.logger?.error('MongoDB change stream error', { err: err.message });
      this.fanout.terminate(err);
    });

    stream.on('close', () => {
      this.deps?.logger?.info('MongoDB change stream closed');
    });

    this.deps?.logger?.info('MongoDB change stream started', {
      collections: this.config.collections ?? 'all',
    });
  }
}
