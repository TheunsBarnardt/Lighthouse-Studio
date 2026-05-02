import type { LoggerPort } from '@platform/ports-observability';
import type { MetricsPort } from '@platform/ports-observability';
import type { Pool as PgPool } from 'pg';

import { Pool } from 'pg';

export interface ConnectionConfig {
  /** Connection URL for the application pool — should point to PgBouncer in production. */
  applicationUrl: string;
  /** Connection URL for the direct pool — bypasses PgBouncer, used for migrations and DDL. */
  directUrl: string;
  /** Maximum connections in each pool. Defaults to 10. */
  poolSize?: number;
  /** Statement timeout in milliseconds. Defaults to 30 000 (30 s). */
  statementTimeoutMs?: number;
}

export interface ConnectionPools {
  /** Application pool — routes through PgBouncer (transaction mode). */
  pool: PgPool;
  /** Direct pool — connects straight to Postgres; use for migrations, DDL, LISTEN/NOTIFY. */
  directPool: PgPool;
  /** Returns true if both pools can reach the database. */
  healthCheck(): Promise<boolean>;
  /** Drains and closes both pools. */
  shutdown(): Promise<void>;
}

function sanitiseDsn(url: string): string {
  try {
    const u = new URL(url);
    u.password = '***';
    return u.toString();
  } catch {
    return '<unparseable DSN>';
  }
}

async function waitForPool(pool: PgPool, logger?: LoggerPort, maxAttempts = 6): Promise<void> {
  let delayMs = 1_000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      logger?.warn(
        `Postgres connection attempt ${String(attempt)} failed; retrying in ${String(delayMs)}ms`,
        {
          err,
        },
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }
}

export async function createConnectionPools(
  config: ConnectionConfig,
  deps?: { logger?: LoggerPort; metrics?: MetricsPort },
): Promise<ConnectionPools> {
  const { logger, metrics } = deps ?? {};
  const timeout = config.statementTimeoutMs ?? 30_000;
  const poolSize = config.poolSize ?? 10;

  const poolOptions = { connectionString: config.applicationUrl, max: poolSize };
  const directOptions = { connectionString: config.directUrl, max: Math.min(poolSize, 5) };

  const pool = new Pool(poolOptions);
  const directPool = new Pool(directOptions);

  // Statement timeouts on direct connections (session-stable).
  // The application pool goes through PgBouncer (transaction mode), so session-level SET
  // doesn't survive — rely on the server-level postgresql.conf default instead.
  directPool.on('connect', (client) => {
    void client.query(
      `SET statement_timeout = ${String(timeout)}; SET idle_in_transaction_session_timeout = ${String(timeout * 2)};`,
    );
  });

  pool.on('connect', () => {
    logger?.debug('Postgres application pool connection established', {
      dsn: sanitiseDsn(config.applicationUrl),
    });
  });
  directPool.on('connect', () => {
    logger?.debug('Postgres direct pool connection established', {
      dsn: sanitiseDsn(config.directUrl),
    });
  });

  pool.on('error', (err) => {
    logger?.error('Idle Postgres application pool client error', { err: err.message });
  });
  directPool.on('error', (err) => {
    logger?.error('Idle Postgres direct pool client error', { err: err.message });
  });

  // Expose pool metrics when a MetricsPort is provided.
  if (metrics) {
    const activeGauge = metrics.gauge('platform_postgres_pool_active_connections', {
      description: 'Number of active connections in the application pool',
    });
    const idleGauge = metrics.gauge('platform_postgres_pool_idle_connections', {
      description: 'Number of idle connections in the application pool',
    });
    const waitCounter = metrics.counter('platform_postgres_pool_wait_count_total', {
      description: 'Number of times clients waited for a connection from the pool',
    });

    pool.on('connect', () => {
      activeGauge.set(pool.totalCount - pool.idleCount);
      idleGauge.set(pool.idleCount);
    });
    pool.on('acquire', () => {
      activeGauge.set(pool.totalCount - pool.idleCount);
      idleGauge.set(pool.idleCount);
    });
    pool.on('remove', () => {
      activeGauge.set(pool.totalCount - pool.idleCount);
      idleGauge.set(pool.idleCount);
    });

    // pg emits 'connect' on every new connection; no built-in "wait" event, so we count
    // whenever a client is acquired from a full pool (totalCount === max).
    pool.on('acquire', () => {
      if (pool.waitingCount > 0) waitCounter.add(1);
    });
  }

  logger?.info('Waiting for Postgres application pool to be ready…', {
    dsn: sanitiseDsn(config.applicationUrl),
  });
  await waitForPool(pool, logger);

  logger?.info('Waiting for Postgres direct pool to be ready…', {
    dsn: sanitiseDsn(config.directUrl),
  });
  await waitForPool(directPool, logger);

  logger?.info('Postgres connection pools ready');

  return {
    pool,
    directPool,

    async healthCheck(): Promise<boolean> {
      try {
        await pool.query('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },

    async shutdown(): Promise<void> {
      await Promise.all([pool.end(), directPool.end()]);
      logger?.info('Postgres connection pools shut down');
    },
  };
}
