export type Fetch = typeof globalThis.fetch;
export type WebSocketCtor = new (url: string, protocols?: string | string[]) => WebSocket;

export interface RuntimeAdapter {
  fetch: Fetch;
  WebSocket: WebSocketCtor;
  /** true when running inside a browser context */
  isBrowser: boolean;
}

declare const __PLATFORM_RUNTIME__: string | undefined;

function detectRuntimeImpl(): RuntimeAdapter {
  // Explicit compile-time override (node-specific build entry)
  if (typeof __PLATFORM_RUNTIME__ !== 'undefined' && __PLATFORM_RUNTIME__ === 'node') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebSocket: NodeWS } = require('ws') as { WebSocket: WebSocketCtor };
    return { fetch: globalThis.fetch, WebSocket: NodeWS, isBrowser: false };
  }

  // Feature detection — prefer native APIs
  const hasBrowserWs = typeof globalThis.WebSocket !== 'undefined';
  const hasFetch = typeof globalThis.fetch === 'function';

  if (!hasFetch) {
    throw new Error(
      '[platform-sdk] No fetch implementation found. Use Node 18+ or provide a fetch polyfill.',
    );
  }

  if (!hasBrowserWs) {
    // Node without native WebSocket (Node < 21 with custom flags) — require ws
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebSocket: NodeWS } = require('ws') as { WebSocket: WebSocketCtor };
    return { fetch: globalThis.fetch, WebSocket: NodeWS, isBrowser: false };
  }

  return {
    fetch: globalThis.fetch,
    WebSocket: globalThis.WebSocket as unknown as WebSocketCtor,
    isBrowser: typeof document !== 'undefined',
  };
}

let _runtime: RuntimeAdapter | null = null;

export function getRuntime(): RuntimeAdapter {
  if (!_runtime) _runtime = detectRuntimeImpl();
  return _runtime;
}

/** Override the runtime adapter — useful for testing or React Native. */
export function setRuntime(adapter: RuntimeAdapter): void {
  _runtime = adapter;
}
