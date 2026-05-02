import type { LoggerPort, MetricsPort } from '@platform/ports-observability';

import { MongoClient, type Db } from 'mongodb';

export interface MongoConnectionConfig {
  /** Full MongoDB connection URI, e.g. "mongodb://user:pass@host:27017/dbname?replicaSet=rs0" */
  uri: string;
  /** Database name to use. Overrides the URI database component if provided. */
  database: string;
  /** Statement timeout per operation in milliseconds. Defaults to 30 000. */
  maxTimeMsDefault?: number;
  /** TLS CA file path for production deployments. */
  tlsCAFile?: string;
  /** Set to true to disable TLS (development only). */
  tlsInsecure?: boolean;
}

export interface MongoConnection {
  client: MongoClient;
  db: Db;
  /** Default maxTimeMS for operations (from config). */
  defaultMaxTimeMs: number;
  healthCheck(): Promise<boolean>;
  shutdown(): Promise<void>;
}

function sanitiseUri(uri: string): string {
  try {
    const u = new URL(uri);
    u.password = '***';
    return u.toString();
  } catch {
    return '<unparseable URI>';
  }
}

async function waitForClient(
  client: MongoClient,
  logger?: LoggerPort,
  maxAttempts = 6,
): Promise<void> {
  let delayMs = 1_000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await client.db('admin').command({ ping: 1 });
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      logger?.warn(
        `MongoDB connection attempt ${String(attempt)} failed; retrying in ${String(delayMs)}ms`,
        { err },
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 30_000);
    }
  }
}

export async function createMongoConnection(
  config: MongoConnectionConfig,
  deps?: { logger?: LoggerPort; metrics?: MetricsPort },
): Promise<MongoConnection> {
  const { logger } = deps ?? {};
  const defaultMaxTimeMs = config.maxTimeMsDefault ?? 30_000;

  const clientOptions: ConstructorParameters<typeof MongoClient>[1] = {
    retryWrites: true,
    retryReads: true,
    readPreference: 'primary',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority', j: true },
    ...(config.tlsCAFile ? { tls: true, tlsCAFile: config.tlsCAFile } : {}),
    ...(config.tlsInsecure ? { tls: true, tlsAllowInvalidCertificates: true } : {}),
    monitorCommands: true,
  };

  const client = new MongoClient(config.uri, clientOptions);

  client.on('commandStarted', (event) => {
    logger?.debug('MongoDB command started', {
      command: event.commandName,
      requestId: event.requestId,
    });
  });
  client.on('connectionCheckOutFailed', (event) => {
    logger?.warn('MongoDB connection checkout failed', { reason: event.reason });
  });

  logger?.info('Connecting to MongoDB…', { uri: sanitiseUri(config.uri) });
  await client.connect();
  await waitForClient(client, logger);
  logger?.info('MongoDB connection ready');

  const db = client.db(config.database);

  return {
    client,
    db,
    defaultMaxTimeMs,

    async healthCheck(): Promise<boolean> {
      try {
        await client.db('admin').command({ ping: 1 });
        return true;
      } catch {
        return false;
      }
    },

    async shutdown(): Promise<void> {
      await client.close();
      logger?.info('MongoDB connection closed');
    },
  };
}
