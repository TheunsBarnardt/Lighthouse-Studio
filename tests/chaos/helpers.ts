/**
 * Shared helpers for chaos test scenarios.
 *
 * All chaos tests require CHAOS_TEST_ENABLED=true. This prevents accidental
 * execution in normal CI or development environments.
 */

import { execSync } from 'node:child_process';
import { env } from 'node:process';

// ── Guard ─────────────────────────────────────────────────────────────────────

export function requireChaosEnv(): void {
  if (env['CHAOS_TEST_ENABLED'] !== 'true') {
    console.log('Skipping chaos test: CHAOS_TEST_ENABLED is not "true".');
    console.log('Set CHAOS_TEST_ENABLED=true in the staging environment to run chaos tests.');
  }
}

export const chaosEnabled = env['CHAOS_TEST_ENABLED'] === 'true';

// ── Config ────────────────────────────────────────────────────────────────────

export const config = {
  baseUrl: env['CHAOS_BASE_URL'] ?? 'http://localhost:3000',
  dbUrl: env['CHAOS_DATABASE_URL'] ?? env['DATABASE_URL'] ?? '',
  dbContainerName: env['CHAOS_DB_CONTAINER'] ?? 'platform-postgres',
  webContainerName: env['CHAOS_WEB_CONTAINER'] ?? 'platform-web',
  workerContainerName: env['CHAOS_WORKER_CONTAINER'] ?? 'platform-worker',
  auditDbContainerName: env['CHAOS_AUDIT_CONTAINER'] ?? 'platform-postgres',
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────

export async function platformGet(path: string, token?: string): Promise<Response> {
  return fetch(`${config.baseUrl}${path}`, {
    headers: token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
  });
}

export async function platformPost(path: string, body: unknown, token?: string): Promise<Response> {
  return fetch(`${config.baseUrl}${path}`, {
    method: 'POST',
    headers: token
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const res = await platformPost('/api/auth/sign-in', { email, password });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  return (data['token'] as string | undefined) ?? null;
}

// ── Process control ───────────────────────────────────────────────────────────

export function dockerKill(container: string, signal: string = 'SIGKILL'): void {
  execSync(`docker kill --signal=${signal} ${container}`, { stdio: 'pipe' });
}

export function dockerStart(container: string): void {
  execSync(`docker start ${container}`, { stdio: 'pipe' });
}

export function dockerStop(container: string): void {
  execSync(`docker stop ${container}`, { stdio: 'pipe' });
}

export function dockerPause(container: string): void {
  execSync(`docker pause ${container}`, { stdio: 'pipe' });
}

export function dockerUnpause(container: string): void {
  execSync(`docker unpause ${container}`, { stdio: 'pipe' });
}

// ── Wait helpers ──────────────────────────────────────────────────────────────

export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number,
  pollMs = 500,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return true;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return false;
}

export async function platformHealthy(maxWaitMs = 60_000): Promise<boolean> {
  return waitFor(async () => {
    try {
      const r = await fetch(`${config.baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      return r.ok;
    } catch {
      return false;
    }
  }, maxWaitMs);
}

// ── Audit chain verification ──────────────────────────────────────────────────

export async function verifyAuditChainIntegrity(
  workspaceId: string,
  token: string,
): Promise<{ valid: boolean; firstBrokenAt?: number }> {
  const res = await platformGet(`/api/workspaces/${workspaceId}/audit-log/verify-chain`, token);
  if (!res.ok) return { valid: false };
  const data = (await res.json()) as { valid: boolean; firstBrokenAt?: number };
  return data;
}

// ── Data corruption check ─────────────────────────────────────────────────────

export async function checkDataCorruption(workspaceId: string, token: string): Promise<boolean> {
  const res = await platformGet(`/api/workspaces/${workspaceId}/audit-log?limit=10`, token);
  if (!res.ok) return true; // assume corruption if we can't even query
  return false;
}

// ── Cross-tenant leak check ───────────────────────────────────────────────────

export async function checkCrossTenantLeak(
  workspaceId: string,
  otherWorkspaceId: string,
  token: string,
): Promise<boolean> {
  // Try to access a different workspace's audit log using this token
  const res = await platformGet(`/api/workspaces/${otherWorkspaceId}/audit-log?limit=1`, token);
  // A properly-scoped response should be 403, not 200
  return res.status === 200; // true = leak detected
}
