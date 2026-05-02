/**
 * /_status route response shape.
 * The actual HTTP handler is wired in the framework in Objective 3+.
 * This module defines the contract so it can be imported by tests and the handler.
 *
 * Access control (enforced in the HTTP handler, not here):
 *   - development: open
 *   - staging / production: requires service-role auth (Objective 6)
 *
 * Returns no secrets. Never expose credentials, connection strings, or key material.
 */

export interface AdapterStatus {
  name: string;
  driver: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

export interface StatusResponse {
  ok: boolean;
  appEnv: string;
  buildSha: string;
  buildTime: string;
  appVersion: string;
  adapters: AdapterStatus[];
}

export interface StatusContext {
  appEnv: string;
  buildSha: string;
  buildTime: string;
  appVersion: string;
  adapters: AdapterStatus[];
}

/**
 * Derives the overall ok flag from the adapter statuses.
 * A single unhealthy adapter marks the whole status as degraded.
 */
export function buildStatusResponse(ctx: StatusContext): StatusResponse {
  const ok = ctx.adapters.every((a) => a.healthy);
  return { ok, ...ctx };
}
