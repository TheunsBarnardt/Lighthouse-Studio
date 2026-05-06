import type { AuthStorageStrategy, Session, Unsubscribe } from './auth/index.js';
import type { RealtimeChannel } from './realtime/index.js';
import type { RuntimeAdapter } from './runtime/index.js';
import type { RetryOptions } from './transport/index.js';

import { AuthClient } from './auth/index.js';
import { DataQueryBuilder } from './data/index.js';
import { QueryClient } from './query/index.js';
import { RealtimeManager, createRealtimeChannel } from './realtime/index.js';
import { setRuntime } from './runtime/index.js';
import { StorageClient } from './storage/index.js';
import { HttpTransport } from './transport/index.js';

export * from './errors/index.js';
export * from './shared-types.js';
// Auth — re-export everything except Unsubscribe (already exported from shared-types)
export type {
  Session,
  User,
  AuthChallenge,
  MfaEnrollment,
  AuthStateEvent,
  AuthStorageStrategy,
  SignInInput,
  SignUpInput,
  SignInProviderOptions,
  ProfileUpdate,
  AuthClientOptions,
} from './auth/index.js';
export { AuthClient } from './auth/index.js';
export * from './data/index.js';
// Realtime — re-export everything except Unsubscribe (already exported from shared-types)
export type { ChangeOperation, ChannelStatus, RealtimeEvent } from './realtime/index.js';
export { RealtimeChannel, RealtimeManager, createRealtimeChannel } from './realtime/index.js';
export * from './storage/index.js';
// Query — SqlQueryResult has a distinct name; no clash
export * from './query/index.js';
export type { RetryOptions, RuntimeAdapter };
export { setRuntime };

// ── Types ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDatabase = Record<string, any>;

export interface CreateClientOptions {
  /** Platform installation base URL (e.g. https://your-platform.example.com). */
  url: string;
  /** Anonymous API key for unauthenticated public access. */
  anonKey?: string | undefined;
  /** Workspace slug — defaults to first workspace the user belongs to. */
  workspace?: string | undefined;
  /** Schema slug — defaults to 'main'. */
  schema?: string | undefined;
  /** Auth token persistence strategy. Default: 'cookie' in browsers, 'memory' elsewhere. */
  authStorage?: AuthStorageStrategy | undefined;
  /** Override fetch implementation (useful for testing). */
  fetch?: typeof globalThis.fetch | undefined;
  /** Enable anonymous SDK telemetry (off by default). */
  telemetry?: boolean | undefined;
  retry?: RetryOptions | undefined;
  /** Request timeout in milliseconds. Default: 30000. */
  timeout?: number | undefined;
  /** Enable OTel W3C trace propagation. Default: false. */
  trace?: boolean | undefined;
}

export interface GqlOptions {
  variables?: Record<string, unknown>;
}

export interface PlatformClient<TDatabase = AnyDatabase> {
  readonly auth: AuthClient;

  /** Fluent builder for data operations on a workspace table. */
  data<TableName extends keyof TDatabase>(table: TableName): DataQueryBuilder<TDatabase[TableName]>;

  /** Execute a GraphQL query or mutation against the workspace's GraphQL endpoint. */
  gql<TResult = unknown>(query: string, opts?: GqlOptions): Promise<TResult>;

  /** Create a realtime subscription channel for a table. */
  realtime<TableName extends keyof TDatabase>(
    table: TableName,
  ): RealtimeChannel<TDatabase[TableName]>;

  /** Access the storage client for a bucket. */
  storage(bucket: string): StorageClient;

  /** Access the query console client. */
  readonly query: QueryClient;

  /** Return a new client scoped to a different workspace. */
  setWorkspace(workspace: string): PlatformClient<TDatabase>;

  /** Return a new client scoped to a different schema. */
  setSchema(schema: string): PlatformClient<TDatabase>;

  /** Current session (null if not authenticated). */
  getSession(): Session | null;

  /** Subscribe to auth state changes. */
  onAuthStateChange: AuthClient['onAuthStateChange'];
}

// ── gql template tag helper ───────────────────────────────────────────────────

export function gql(
  strings: TemplateStringsArray,
  ...values: (string | number | boolean | null | undefined)[]
): string {
  return strings.reduce((acc, str, i) => acc + str + String(values[i] ?? ''), '');
}

// ── createClient ──────────────────────────────────────────────────────────────

export function createClient<TDatabase = AnyDatabase>(
  opts: CreateClientOptions,
): PlatformClient<TDatabase> {
  return buildClient<TDatabase>(opts, opts.workspace ?? 'default', opts.schema ?? 'main');
}

function buildClient<TDatabase>(
  opts: CreateClientOptions,
  workspace: string,
  schema: string,
): PlatformClient<TDatabase> {
  // Transport is created first; auth client is wired in via closure once constructed.
  let auth: AuthClient | null = null;

  const transport = new HttpTransport({
    baseUrl: opts.url,
    timeout: opts.timeout,
    retry: opts.retry,
    trace: opts.trace,
    getToken: () => {
      const userToken = auth?.getToken();
      if (userToken) return userToken;
      return opts.anonKey ?? null;
    },
    onTokenExpired: async () => {
      await auth?.refreshSession();
    },
  });

  auth = new AuthClient({ transport, storageStrategy: opts.authStorage });

  const wsUrl = opts.url.replace(/^http/, 'ws') + '/api/v1/realtime';
  const realtimeManager = new RealtimeManager({
    wsUrl,
    getToken: () => auth.getToken() ?? opts.anonKey ?? null,
  });

  const queryClient = new QueryClient(transport, workspace, schema);

  const client: PlatformClient<TDatabase> = {
    auth,

    data<TableName extends keyof TDatabase>(
      table: TableName,
    ): DataQueryBuilder<TDatabase[TableName]> {
      return new DataQueryBuilder<TDatabase[TableName]>(
        transport,
        table as string,
        workspace,
        schema,
      );
    },

    async gql<TResult = unknown>(query: string, gqlOpts?: GqlOptions): Promise<TResult> {
      const result = await transport.request<{ data: TResult; errors?: unknown[] }>({
        method: 'POST',
        path: `/api/v1/graphql/${workspace}`,
        body: { query, variables: gqlOpts?.variables },
        noIdempotency: true,
      });
      if (result.errors?.length) {
        throw Object.assign(new Error('GraphQL error'), { errors: result.errors });
      }
      return result.data;
    },

    realtime<TableName extends keyof TDatabase>(
      table: TableName,
    ): RealtimeChannel<TDatabase[TableName]> {
      return createRealtimeChannel<TDatabase[TableName]>(
        table as string,
        workspace,
        schema,
        realtimeManager as unknown as RealtimeManager,
      );
    },

    storage(bucket: string): StorageClient {
      return new StorageClient(transport, bucket, workspace);
    },

    query: queryClient,

    setWorkspace(newWorkspace: string): PlatformClient<TDatabase> {
      return buildClient<TDatabase>(opts, newWorkspace, schema);
    },

    setSchema(newSchema: string): PlatformClient<TDatabase> {
      return buildClient<TDatabase>(opts, workspace, newSchema);
    },

    getSession(): Session | null {
      return auth.getSession();
    },

    onAuthStateChange(handler: Parameters<AuthClient['onAuthStateChange']>[0]): Unsubscribe {
      return auth.onAuthStateChange(handler);
    },
  };

  // Opt-in telemetry
  if (opts.telemetry) {
    void import('./telemetry.js')
      .then((m) => m.initTelemetry(opts.url))
      .catch(() => {
        /* non-critical */
      });
  }

  return client;
}
