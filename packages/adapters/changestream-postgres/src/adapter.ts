import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type {
  ChangeEvent,
  ChangeStreamCapabilities,
  ChangeStreamPort,
  SubscribeOptions,
} from '@platform/ports-persistence';

// eslint-disable-next-line no-restricted-imports -- shared fanout utility for changestream adapters only
import { ChangeStreamFanout } from '@platform/adapter-changestream-shared';
import { Client } from 'pg';

// ── Config ────────────────────────────────────────────────────────────────────

export interface PostgresChangeStreamConfig {
  /** PostgreSQL connection URL. Must connect as a superuser or replication-capable role. */
  connectionUrl: string;
  /**
   * Logical replication slot name. Must already exist or be created by this adapter.
   * Format: platform_<instance> (e.g. "platform_main").
   */
  slotName: string;
  /**
   * Publication name. Must already exist (created by migrations/DBA).
   * The publication defines which tables/operations are included.
   */
  publicationName: string;
  /** Tables to watch (application-side filter applied to decoded events). All tables if omitted. */
  tables?: string[];
  /** Buffer size per subscriber. Defaults to 1 000. */
  bufferSize?: number;
  /** Keepalive interval in milliseconds. Defaults to 10 000. */
  keepaliveIntervalMs?: number;
}

// ── pgoutput message types ────────────────────────────────────────────────────
// The pgoutput plugin sends binary-encoded messages. We parse them here.

type PgOutputMessageType = 'B' | 'C' | 'I' | 'U' | 'D' | 'R' | 'T' | 'O' | 'M' | 'Y';

interface RelationMessage {
  type: 'R';
  relationId: number;
  schema: string;
  table: string;
  columns: string[];
}

interface InsertMessage {
  type: 'I';
  relationId: number;
  newRow: Record<string, unknown>;
}

interface UpdateMessage {
  type: 'U';
  relationId: number;
  oldRow: Record<string, unknown> | null;
  newRow: Record<string, unknown>;
}

interface DeleteMessage {
  type: 'D';
  relationId: number;
  oldRow: Record<string, unknown> | null;
}

type ParsedMessage =
  | RelationMessage
  | InsertMessage
  | UpdateMessage
  | DeleteMessage
  | { type: string };

// ── Binary message parsing ────────────────────────────────────────────────────

function readString(buf: Buffer, offset: { value: number }): string {
  const end = buf.indexOf(0, offset.value);
  const str = buf.toString('utf8', offset.value, end);
  offset.value = end + 1;
  return str;
}

function readInt32(buf: Buffer, offset: { value: number }): number {
  const val = buf.readInt32BE(offset.value);
  offset.value += 4;
  return val;
}

function readInt16(buf: Buffer, offset: { value: number }): number {
  const val = buf.readInt16BE(offset.value);
  offset.value += 2;
  return val;
}

function parseRow(
  buf: Buffer,
  offset: { value: number },
  colCount: number,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  // Column data is indexed; map to column names later via relation map
  for (let i = 0; i < colCount; i++) {
    const kind = String.fromCharCode(buf[offset.value] ?? 0);
    offset.value += 1;
    if (kind === 'n') {
      row[String(i)] = null;
    } else if (kind === 't') {
      const len = readInt32(buf, offset);
      const val = buf.toString('utf8', offset.value, offset.value + len);
      offset.value += len;
      row[String(i)] = val;
    } else {
      row[String(i)] = null;
    }
  }
  return row;
}

function parseMessage(data: Buffer, relations: Map<number, RelationMessage>): ParsedMessage | null {
  if (data.length === 0) return null;

  const msgType = String.fromCharCode(data[0] ?? 0) as PgOutputMessageType;
  const offset = { value: 1 };

  if (msgType === 'R') {
    offset.value += 4; // flags
    const relationId = readInt32(data, offset);
    const schema = readString(data, offset);
    const table = readString(data, offset);
    offset.value += 1; // replicaIdentity
    const colCount = readInt16(data, offset);
    const columns: string[] = [];
    for (let i = 0; i < colCount; i++) {
      offset.value += 1; // flags
      columns.push(readString(data, offset));
      offset.value += 4; // typeId
      offset.value += 4; // typeModifier
    }
    const rel: RelationMessage = { type: 'R', relationId, schema, table, columns };
    relations.set(relationId, rel);
    return rel;
  }

  if (msgType === 'I') {
    offset.value += 4; // lsn part
    const relationId = readInt32(data, offset);
    offset.value += 1; // 'N' marker
    const rel = relations.get(relationId);
    const colCount = rel ? rel.columns.length : 0;
    const rawRow = parseRow(data, offset, colCount);
    const row: Record<string, unknown> = {};
    if (rel) {
      for (let i = 0; i < rel.columns.length; i++) {
        row[rel.columns[i] ?? String(i)] = rawRow[String(i)];
      }
    }
    return { type: 'I', relationId, newRow: row };
  }

  if (msgType === 'U') {
    offset.value += 4;
    const relationId = readInt32(data, offset);
    const rel = relations.get(relationId);
    const colCount = rel ? rel.columns.length : 0;
    const marker = String.fromCharCode(data[offset.value] ?? 0);
    let oldRow: Record<string, unknown> | null = null;
    if (marker === 'O' || marker === 'K') {
      offset.value += 1;
      const raw = parseRow(data, offset, colCount);
      oldRow = {};
      if (rel) {
        for (let i = 0; i < rel.columns.length; i++) {
          oldRow[rel.columns[i] ?? String(i)] = raw[String(i)];
        }
      }
    }
    offset.value += 1; // 'N' marker
    const rawNew = parseRow(data, offset, colCount);
    const newRow: Record<string, unknown> = {};
    if (rel) {
      for (let i = 0; i < rel.columns.length; i++) {
        newRow[rel.columns[i] ?? String(i)] = rawNew[String(i)];
      }
    }
    return { type: 'U', relationId, oldRow, newRow };
  }

  if (msgType === 'D') {
    offset.value += 4;
    const relationId = readInt32(data, offset);
    const rel = relations.get(relationId);
    const colCount = rel ? rel.columns.length : 0;
    offset.value += 1;
    const raw = parseRow(data, offset, colCount);
    const oldRow: Record<string, unknown> = {};
    if (rel) {
      for (let i = 0; i < rel.columns.length; i++) {
        oldRow[rel.columns[i] ?? String(i)] = raw[String(i)];
      }
    }
    return { type: 'D', relationId, oldRow };
  }

  return { type: msgType };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

let globalSeq = BigInt(0);
function nextSeq(): bigint {
  globalSeq += BigInt(1);
  return globalSeq;
}

export class PostgresChangeStreamAdapter implements ChangeStreamPort {
  private readonly fanout: ChangeStreamFanout;
  private client: Client | null = null;
  private started = false;
  private readonly relations = new Map<number, RelationMessage>();

  constructor(
    private readonly config: PostgresChangeStreamConfig,
    private readonly deps?: { logger?: LoggerPort; metrics?: MetricsPort },
  ) {
    this.fanout = new ChangeStreamFanout(deps);
  }

  capabilities(): ChangeStreamCapabilities {
    return {
      beforeImages: true,
      sourceFiltering: true,
      resumable: true,
      prerequisites: [
        'wal_level must be set to logical in postgresql.conf',
        `Publication "${this.config.publicationName}" must exist`,
        `Replication slot "${this.config.slotName}" must exist or the replication role must have CREATE REPLICATION SLOT privilege`,
        'The connecting user must have REPLICATION privilege or be a superuser',
      ],
    };
  }

  subscribe(opts: SubscribeOptions = {}): AsyncIterable<ChangeEvent> {
    if (!this.started) {
      this.started = true;
      void this.startReplication(opts.resumeToken);
    }
    return this.fanout.createSubscription(opts);
  }

  async close(): Promise<void> {
    this.fanout.close();
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
    this.deps?.logger?.info('Postgres change stream adapter closed');
  }

  private async startReplication(startLsn?: string): Promise<void> {
    try {
      const client = new Client({ connectionString: this.config.connectionUrl });
      this.client = client;
      await client.connect();

      // Ensure the replication slot exists
      try {
        await client.query(`SELECT pg_create_logical_replication_slot($1, 'pgoutput')`, [
          this.config.slotName,
        ]);
        this.deps?.logger?.info('Created replication slot', { slot: this.config.slotName });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== '42710') {
          // 42710 = duplicate_object; slot already exists, that's fine
          throw e;
        }
        this.deps?.logger?.debug('Replication slot already exists', { slot: this.config.slotName });
      }

      this.deps?.logger?.info('Starting logical replication', {
        slot: this.config.slotName,
        publication: this.config.publicationName,
        startLsn: startLsn ?? 'current',
      });

      // pg module's query interface is used for simple protocol;
      // for streaming replication, we use the copy-both protocol via the connection
      // The actual replication protocol is handled via pg's internal mechanisms.
      // Using a simplified approach: poll-based WAL consumer via pg_logical_slot_get_binary_changes

      void this.pollLoop(client, startLsn);
    } catch (e) {
      this.deps?.logger?.error('Failed to start Postgres change stream', { err: String(e) });
      this.fanout.terminate(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private async pollLoop(client: Client, startLsn?: string): Promise<void> {
    let lastLsn = startLsn ?? '0/0';
    const keepaliveMs = this.config.keepaliveIntervalMs ?? 10_000;

    while (this.client !== null) {
      try {
        // Use pg_logical_slot_get_binary_changes to poll for changes
        const res = await client.query<{ lsn: string; xid: string; data: Buffer }>(
          `SELECT lsn, xid, data
           FROM pg_logical_slot_get_binary_changes($1, $2, 100,
             'proto_version', '1',
             'publication_names', $3
           )`,
          [this.config.slotName, lastLsn === '0/0' ? null : lastLsn, this.config.publicationName],
        );

        for (const row of res.rows) {
          const seq = nextSeq();
          const resumeToken = row.lsn;
          lastLsn = row.lsn;

          const parsed = parseMessage(row.data, this.relations);
          if (!parsed) continue;

          if (parsed.type === 'R') continue; // relation messages are metadata only

          const rel = this.relations.get((parsed as { relationId?: number }).relationId ?? -1);
          const table = rel?.table ?? 'unknown';

          // Application-side table filter
          if (
            this.config.tables &&
            this.config.tables.length > 0 &&
            !this.config.tables.includes(table)
          ) {
            continue;
          }

          let event: ChangeEvent | null = null;
          if (parsed.type === 'I') {
            const msg = parsed as InsertMessage;
            event = {
              kind: 'insert',
              sequenceNumber: seq,
              detectedAt: new Date(),
              resumeToken,
              table,
              rowId: String((msg.newRow['id'] as string | undefined) ?? ''),
              after: msg.newRow,
            };
          } else if (parsed.type === 'U') {
            const msg = parsed as UpdateMessage;
            event = {
              kind: 'update',
              sequenceNumber: seq,
              detectedAt: new Date(),
              resumeToken,
              table,
              rowId: String((msg.newRow['id'] as string | undefined) ?? ''),
              before: msg.oldRow,
              after: msg.newRow,
            };
          } else if (parsed.type === 'D') {
            const msg = parsed as DeleteMessage;
            event = {
              kind: 'delete',
              sequenceNumber: seq,
              detectedAt: new Date(),
              resumeToken,
              table,
              rowId: String(((msg.oldRow ?? {})['id'] as string | undefined) ?? ''),
              before: msg.oldRow,
            };
          }

          if (event) this.fanout.publish(event);
        }

        // If no changes, wait a bit before polling again
        if (res.rows.length === 0) {
          await new Promise((resolve) => setTimeout(resolve, keepaliveMs));
        }
      } catch (e) {
        this.deps?.logger?.error('Postgres replication poll error', { err: String(e) });
        this.fanout.terminate(e instanceof Error ? e : new Error(String(e)));
        break;
      }
    }
  }
}
