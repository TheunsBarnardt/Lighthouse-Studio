/** Anonymous opt-in telemetry. Never collects user data, workspace IDs, or query content. */

interface TelemetryPayload {
  event: string;
  sdkVersion: string;
  runtime: string;
}

const SDK_VERSION = '0.1.0';

function detectRuntime(): string {
  if (typeof process !== 'undefined' && process.versions.node) return 'node';
  // @ts-expect-error Deno is not in standard lib
  if (typeof Deno !== 'undefined') return 'deno';
  // @ts-expect-error Bun is not in standard lib
  if (typeof Bun !== 'undefined') return 'bun';
  if (typeof navigator !== 'undefined') return 'browser';
  return 'unknown';
}

export async function initTelemetry(platformUrl: string): Promise<void> {
  const payload: TelemetryPayload = {
    event: 'sdk_init',
    sdkVersion: SDK_VERSION,
    runtime: detectRuntime(),
  };

  try {
    await fetch(`${platformUrl}/api/v1/telemetry/sdk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Telemetry failure must never affect the SDK
  }
}
