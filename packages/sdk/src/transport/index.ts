import { NetworkError, TimeoutError, parseApiError, PlatformError } from '../errors/index.js';
import { getRuntime } from '../runtime/index.js';
import { uuidv4 } from '../util.js';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface TransportOptions {
  baseUrl: string;
  timeout?: number | undefined;
  retry?: RetryOptions | undefined;
  trace?: boolean | undefined;
  getToken?: (() => string | null | undefined) | undefined;
  onTokenExpired?: (() => Promise<void>) | undefined;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_RETRY: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 10_000,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number, opts: Required<RetryOptions>): number {
  const base = opts.baseDelayMs * 2 ** attempt;
  return Math.min(base + Math.random() * opts.baseDelayMs, opts.maxDelayMs);
}

export interface RequestOptions {
  method?: string;
  path: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** Skip automatic idempotency key generation (for reads). */
  noIdempotency?: boolean;
}

interface ResolvedTransportOptions {
  baseUrl: string;
  timeout: number;
  retry: Required<RetryOptions>;
  trace: boolean;
  getToken?: (() => string | null | undefined) | undefined;
  onTokenExpired?: (() => Promise<void>) | undefined;
}

export class HttpTransport {
  private readonly opts: ResolvedTransportOptions;
  private _refreshing = false;

  constructor(opts: TransportOptions) {
    this.opts = {
      baseUrl: opts.baseUrl.replace(/\/$/, ''),
      timeout: opts.timeout ?? DEFAULT_TIMEOUT,
      retry: { ...DEFAULT_RETRY, ...opts.retry },
      trace: opts.trace ?? false,
      getToken: opts.getToken,
      onTokenExpired: opts.onTokenExpired,
    };
  }

  /** Absolute base URL (no trailing slash). Used by StorageClient for multipart uploads. */
  getBaseUrl(): string {
    return this.opts.baseUrl;
  }

  /** Current auth + idempotency headers (for raw fetch calls from sub-clients). */
  getAuthHeaders(idempotencyKey?: string): Record<string, string> {
    const token = this.opts.getToken?.();
    const out: Record<string, string> = {};
    if (token) out['Authorization'] = `Bearer ${token}`;
    if (idempotencyKey) out['Idempotency-Key'] = idempotencyKey;
    return out;
  }

  async request<T>(req: RequestOptions): Promise<T> {
    const method = (req.method ?? 'GET').toUpperCase();
    const url = this.buildUrl(req.path, req.params);
    const isMutation = method !== 'GET' && method !== 'HEAD';

    const idempotencyKey =
      isMutation && !req.noIdempotency ? (req.idempotencyKey ?? uuidv4()) : undefined;

    const retryOpts = this.opts.retry;
    let lastError: PlatformError | null = null;

    for (let attempt = 0; attempt < retryOpts.maxAttempts; attempt++) {
      if (attempt > 0) {
        await delay(backoffMs(attempt - 1, retryOpts));
      }

      try {
        const result = await this.executeOnce<T>({ method, url, req, idempotencyKey });
        return result;
      } catch (err) {
        if (err instanceof PlatformError) {
          // Don't retry 4xx client errors (except 429 rate-limited)
          if (
            err.status !== undefined &&
            err.status >= 400 &&
            err.status < 500 &&
            err.status !== 429
          ) {
            throw err;
          }
          lastError = err;
        } else {
          throw err;
        }
      }
    }

    throw lastError ?? new NetworkError('Request failed after retries');
  }

  private async executeOnce<T>(args: {
    method: string;
    url: string;
    req: RequestOptions;
    idempotencyKey: string | undefined;
  }): Promise<T> {
    const { fetch: fetchImpl } = getRuntime();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort('timeout');
    }, this.opts.timeout);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const token = this.opts.getToken?.();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (args.idempotencyKey) headers['Idempotency-Key'] = args.idempotencyKey;

    if (this.opts.trace) {
      // Propagate W3C traceparent if available (OTel opt-in)
      const traceparent = generateTraceparent();
      if (traceparent) headers['traceparent'] = traceparent;
    }

    const signal = args.req.signal
      ? anySignal([controller.signal, args.req.signal])
      : controller.signal;

    let response: Response;
    try {
      const bodyStr = args.req.body !== undefined ? JSON.stringify(args.req.body) : null;
      const fetchInit: RequestInit = { method: args.method, headers, signal };
      if (bodyStr !== null) fetchInit.body = bodyStr;
      response = await fetchImpl(args.url, fetchInit);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError();
      }
      throw new NetworkError('Network request failed', err instanceof Error ? err : undefined);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const correlationId = response.headers.get('X-Correlation-Id') ?? undefined;
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }

      // 401 — trigger token refresh once; guard against re-entrant refresh
      if (response.status === 401 && this.opts.onTokenExpired && !this._refreshing) {
        this._refreshing = true;
        try {
          await this.opts.onTokenExpired();
        } finally {
          this._refreshing = false;
        }
        throw parseApiError(body, response.status, correlationId);
      }

      throw parseApiError(body, response.status, correlationId);
    }

    if (response.status === 204) return undefined as T;

    try {
      return (await response.json()) as T;
    } catch {
      return undefined as T;
    }
  }

  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(this.opts.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
}

/** Combine multiple abort signals — aborts when any one aborts. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort(sig.reason);
      break;
    }
    sig.addEventListener(
      'abort',
      () => {
        controller.abort(sig.reason);
      },
      { once: true },
    );
  }
  return controller.signal;
}

/** Generate a W3C traceparent header value using crypto.randomUUID if available. */
function generateTraceparent(): string | null {
  try {
    const traceId = uuidv4().replace(/-/g, '');
    const spanId = uuidv4().replace(/-/g, '').slice(0, 16);
    return `00-${traceId}-${spanId}-01`;
  } catch {
    return null;
  }
}
