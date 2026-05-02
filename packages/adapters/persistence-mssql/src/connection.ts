import type { LoggerPort, MetricsPort } from '@platform/ports-observability';

import * as mssql from 'mssql';

export interface MssqlConnectionConfig {
  server: string;
  port?: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  /** Named instance (e.g. "SQLEXPRESS") */
  instanceName?: string;
  /** NTLM domain for Windows-authenticated connections */
  domain?: string;
  poolSize?: number;
  requestTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

export interface MssqlConnection {
  pool: mssql.ConnectionPool;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}

function sanitiseServer(config: MssqlConnectionConfig): string {
  return `${config.server}:${String(config.port ?? 1433)}/${config.database}`;
}

async function waitForPool(
  pool: mssql.ConnectionPool,
  logger?: LoggerPort,
  maxAttempts = 6,
): Promise<void> {
  let delayMs = 1_000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.request().query('SELECT 1 AS ok');
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      logger?.warn(
        `MSSQL connection attempt ${String(attempt)} failed; retrying in ${String(delayMs)}ms`,
        { err },
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }
}

export async function createMssqlConnection(
  config: MssqlConnectionConfig,
  deps?: { logger?: LoggerPort; metrics?: MetricsPort },
): Promise<MssqlConnection> {
  const { logger, metrics } = deps ?? {};
  const requestTimeout = config.requestTimeoutMs ?? 30_000;
  const connectionTimeout = config.connectionTimeoutMs ?? 15_000;
  const poolMax = config.poolSize ?? 10;

  const poolConfig: mssql.config = {
    server: config.server,
    port: config.port ?? 1433,
    database: config.database,
    user: config.user,
    password: config.password,
    domain: config.domain,
    options: {
      encrypt: config.encrypt ?? true,
      trustServerCertificate: config.trustServerCertificate ?? false,
      enableArithAbort: true,
      instanceName: config.instanceName,
    },
    pool: {
      min: 1,
      max: poolMax,
      idleTimeoutMillis: 60_000,
    },
    requestTimeout,
    connectionTimeout,
  };

  const pool = new mssql.ConnectionPool(poolConfig);

  pool.on('connect', () => {
    logger?.debug('MSSQL pool connection established', { server: sanitiseServer(config) });
  });
  pool.on('error', (err: Error) => {
    logger?.error('MSSQL pool error', { err: err.message });
  });

  if (metrics) {
    const activeGauge = metrics.gauge('platform_mssql_pool_active_connections', {
      description: 'Number of active MSSQL connections',
    });
    const idleGauge = metrics.gauge('platform_mssql_pool_idle_connections', {
      description: 'Number of idle MSSQL connections',
    });
    pool.on('connect', () => {
      activeGauge.set(pool.size - pool.available);
      idleGauge.set(pool.available);
    });
  }

  await pool.connect();

  logger?.info('Waiting for MSSQL pool to be ready…', { server: sanitiseServer(config) });
  await waitForPool(pool, logger);
  logger?.info('MSSQL connection pool ready');

  return {
    pool,

    async healthCheck(): Promise<boolean> {
      try {
        await pool.request().query('SELECT 1 AS ok');
        return true;
      } catch {
        return false;
      }
    },

    async shutdown(): Promise<void> {
      await pool.close();
      logger?.info('MSSQL connection pool shut down');
    },
  };
}
