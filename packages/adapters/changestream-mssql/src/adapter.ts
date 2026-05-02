import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type {
  ChangeEvent,
  ChangeStreamCapabilities,
  ChangeStreamPort,
  SubscribeOptions,
} from '@platform/ports-persistence';

// eslint-disable-next-line no-restricted-imports -- shared fanout utility for changestream adapters only
import { ChangeStreamFanout } from '@platform/adapter-changestream-shared';
import * as mssql from 'mssql';

// ── Config ────────────────────────────────────────────────────────────────────

export interface MssqlChangeStreamConfig {
  /**
   * Tables to watch. Each entry is "[schema].[table]" or just "[table]" (defaults to dbo).
   * CDC must already be enabled on each table via sys.sp_cdc_enable_table.
   */
  tables: string[];
  /**
   * Polling interval in milliseconds. Defaults to 5 000.
   * Shorter intervals increase load; longer intervals increase latency.
   */
  pollIntervalMs?: number;
  /**
   * Buffer size per subscriber. Defaults to 1 000.
   */
  bufferSize?: number;
  /**
   * Schema to use for CDC tracking table. Defaults to 'dbo'.
   */
  trackingSchema?: string;
}

// ── CDC row types ─────────────────────────────────────────────────────────────

// $__$operation values:
// 1 = DELETE before image, 2 = INSERT, 3 = UPDATE before image, 4 = UPDATE after image

const CDC_OP_DELETE = 1;
const CDC_OP_INSERT = 2;
const CDC_OP_UPDATE_BEFORE = 3;
const CDC_OP_UPDATE_AFTER = 4;

// ── Adapter ───────────────────────────────────────────────────────────────────

let globalSeq = BigInt(0);
function nextSeq(): bigint {
  globalSeq += BigInt(1);
  return globalSeq;
}

function lsnToString(lsn: Buffer | null): string {
  if (!lsn) return '0x0';
  return '0x' + lsn.toString('hex').toUpperCase();
}

function tableToCaptureName(table: string): string {
  // CDC capture instance name: schema_table (dbo_mytable)
  const parts = table.replace(/[\[\]]/g, '').split('.');
  return parts.length === 2
    ? `${parts[0] ?? 'dbo'}_${parts[1] ?? 'unknown'}`
    : `dbo_${parts[0] ?? 'unknown'}`;
}

export class MssqlChangeStreamAdapter implements ChangeStreamPort {
  private readonly fanout: ChangeStreamFanout;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLsn: Buffer | null = null;
  private started = false;
  private closed = false;

  constructor(
    private readonly pool: mssql.ConnectionPool,
    private readonly config: MssqlChangeStreamConfig,
    private readonly deps?: { logger?: LoggerPort; metrics?: MetricsPort },
  ) {
    this.fanout = new ChangeStreamFanout(deps);
  }

  capabilities(): ChangeStreamCapabilities {
    return {
      beforeImages: true,
      sourceFiltering: false,
      resumable: true,
      prerequisites: [
        'SQL Server Agent must be running',
        'CDC must be enabled on the database: EXEC sys.sp_cdc_enable_db',
        `CDC must be enabled on each tracked table: EXEC sys.sp_cdc_enable_table`,
        'The connecting user must have SELECT on cdc.* system tables',
        'SQL Server Enterprise or Developer edition (CDC not available on Express)',
      ],
    };
  }

  subscribe(opts: SubscribeOptions = {}): AsyncIterable<ChangeEvent> {
    if (!this.started) {
      this.started = true;
      void this.initAndPoll(opts.resumeToken);
    }
    return this.fanout.createSubscription(opts);
  }

  close(): Promise<void> {
    this.closed = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.fanout.close();
    this.deps?.logger?.info('MSSQL CDC change stream adapter closed');
    return Promise.resolve();
  }

  private async initAndPoll(resumeToken?: string): Promise<void> {
    // Set initial LSN from resume token or from the current max LSN
    if (resumeToken) {
      try {
        this.lastLsn = Buffer.from(resumeToken.replace(/^0x/i, ''), 'hex');
      } catch {
        this.lastLsn = null;
      }
    }

    if (!this.lastLsn) {
      try {
        const res = await this.pool
          .request()
          .query<{ lsn: Buffer }>('SELECT sys.fn_cdc_get_max_lsn() AS lsn');
        this.lastLsn = res.recordset[0]?.lsn ?? null;
      } catch (e) {
        this.deps?.logger?.warn('Could not fetch initial CDC LSN; starting from beginning', {
          err: String(e),
        });
      }
    }

    await this.poll();
  }

  private async poll(): Promise<void> {
    if (this.closed) return;

    try {
      const req = this.pool.request();
      const minLsnRes = await req.query<{ lsn: Buffer }>(
        'SELECT sys.fn_cdc_get_min_lsn(NULL) AS lsn',
      );
      const maxLsnRes = await this.pool
        .request()
        .query<{ lsn: Buffer }>('SELECT sys.fn_cdc_get_max_lsn() AS lsn');

      const fromLsn = this.lastLsn ?? minLsnRes.recordset[0]?.lsn ?? null;
      const toLsn = maxLsnRes.recordset[0]?.lsn ?? null;

      if (!fromLsn || !toLsn) {
        this.schedulePoll();
        return;
      }

      // Compare fromLsn and toLsn: if they are equal, no new changes
      if (fromLsn.equals(toLsn)) {
        this.schedulePoll();
        return;
      }

      for (const table of this.config.tables) {
        await this.pollTable(table, fromLsn, toLsn);
      }

      this.lastLsn = toLsn;
    } catch (e) {
      this.deps?.logger?.error('MSSQL CDC poll error', { err: String(e) });
      this.fanout.terminate(e instanceof Error ? e : new Error(String(e)));
      return;
    }

    this.schedulePoll();
  }

  private schedulePoll(): void {
    if (this.closed) return;
    const interval = this.config.pollIntervalMs ?? 5_000;
    this.pollTimer = setTimeout(() => {
      void this.poll();
    }, interval);
  }

  private async pollTable(table: string, fromLsn: Buffer, toLsn: Buffer): Promise<void> {
    const captureName = tableToCaptureName(table);
    const tableShort =
      table
        .replace(/[\[\]]/g, '')
        .split('.')
        .pop() ?? table;

    try {
      const req = this.pool.request();
      req.input('fromLsn', mssql.VarBinary, fromLsn);
      req.input('toLsn', mssql.VarBinary, toLsn);

      const res = await req.query<Record<string, unknown>>(
        `SELECT *
         FROM cdc.fn_cdc_get_all_changes_${captureName}(@fromLsn, @toLsn, 'all update old')
         ORDER BY [$__$start_lsn]`,
      );

      let prevRow: Record<string, unknown> | null = null;

      for (const row of res.recordset) {
        const op = row['$__$operation'] as number;
        const lsn = row['$__$start_lsn'] as Buffer;
        const resumeToken = lsnToString(lsn);
        const seq = nextSeq();

        const dataRow: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(row)) {
          if (!key.startsWith('$__$')) {
            dataRow[key] = val;
          }
        }

        const rowId = String((dataRow['id'] as string | undefined) ?? '');

        let event: ChangeEvent | null = null;

        if (op === CDC_OP_INSERT) {
          event = {
            kind: 'insert',
            sequenceNumber: seq,
            detectedAt: new Date(),
            resumeToken,
            table: tableShort,
            rowId,
            after: dataRow,
          };
        } else if (op === CDC_OP_UPDATE_BEFORE) {
          prevRow = dataRow;
        } else if (op === CDC_OP_UPDATE_AFTER) {
          event = {
            kind: 'update',
            sequenceNumber: seq,
            detectedAt: new Date(),
            resumeToken,
            table: tableShort,
            rowId,
            before: prevRow,
            after: dataRow,
          };
          prevRow = null;
        } else if (op === CDC_OP_DELETE) {
          event = {
            kind: 'delete',
            sequenceNumber: seq,
            detectedAt: new Date(),
            resumeToken,
            table: tableShort,
            rowId,
            before: dataRow,
          };
        }

        if (event) this.fanout.publish(event);
      }
    } catch (e) {
      this.deps?.logger?.warn(`CDC poll failed for table ${table}`, { err: String(e) });
      // Don't terminate the stream for a single table failure; skip and continue
    }
  }
}
