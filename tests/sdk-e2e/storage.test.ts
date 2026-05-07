import type { ProgressEvent } from '@platform/sdk';

/**
 * SDK E2E — Storage (DoD 15–17, Objective 19)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { E2E_ENABLED, makeClient, testCredentials } from './helpers.js';

describe.skipIf(!E2E_ENABLED)('Storage E2E', () => {
  const client = makeClient();
  let uploadedPath = '';

  beforeAll(async () => {
    await client.auth.signIn(testCredentials);
  });

  afterAll(async () => {
    if (uploadedPath) {
      await client.storage('e2e').delete(uploadedPath);
    }
    await client.auth.signOut();
  });

  it('DoD-15: simple upload of 1 MB file succeeds', async () => {
    const content = new Uint8Array(1024 * 1024).fill(0xab);
    const file = new Blob([content], { type: 'application/octet-stream' });

    const record = await client.storage('e2e').upload(file, { filename: 'test-1mb.bin' });
    uploadedPath = record.path;
    expect(record.path).toBeTruthy();
    expect(record.size).toBe(1024 * 1024);
  });

  it('DoD-17: download via signed URL retrieves the file', async () => {
    const url = await client.storage('e2e').getSignedUrl(uploadedPath);
    const resp = await fetch(url);
    expect(resp.ok).toBe(true);
    const buf = await resp.arrayBuffer();
    expect(buf.byteLength).toBe(1024 * 1024);
  });

  it('DoD-16: resumable upload fires progress events', async () => {
    const content = new Uint8Array(5 * 1024 * 1024 + 1).fill(0xcd);
    const file = new Blob([content], { type: 'application/octet-stream' });
    const progressEvents: number[] = [];

    const op = client.storage('e2e').upload(file, {
      filename: 'test-5mb.bin',
      resumable: true,
    });
    op.on('progress', (e: unknown) => progressEvents.push((e as ProgressEvent).uploaded));

    const record = await op;
    expect(record.path).toBeTruthy();
    expect(progressEvents.length).toBeGreaterThan(0);

    await client.storage('e2e').delete('test-5mb.bin');
  });
});
