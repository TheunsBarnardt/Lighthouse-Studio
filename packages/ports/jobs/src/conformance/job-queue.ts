import { describe, expect, it } from 'vitest';

import type { JobQueuePort } from '../job-queue.port.js';

export function runJobQueueConformance(name: string, factory: () => Promise<JobQueuePort>): void {
  describe(`${name} — JobQueuePort conformance`, () => {
    it('enqueue returns a job record', async () => {
      const queue = await factory();
      const result = await queue.enqueue('test-queue', 'test.job', { value: 1 });
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().id).toBeTruthy();
      expect(result._unsafeUnwrap().status).toBe('pending');
    });

    it('findById returns null for a nonexistent job', async () => {
      const queue = await factory();
      const result = await queue.findById('nonexistent-job-id');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('cancel sets job status to cancelled', async () => {
      const queue = await factory();
      const enqueued = await queue.enqueue('cancel-queue', 'cancel.job', {});
      const jobId = enqueued._unsafeUnwrap().id;
      await queue.cancel(jobId);
      const found = await queue.findById(jobId);
      expect(found._unsafeUnwrap()?.status).toBe('cancelled');
    });

    it('listByQueue returns enqueued jobs', async () => {
      const queue = await factory();
      const q = `list-queue-${String(Date.now())}`;
      await queue.enqueue(q, 'list.job', {});
      await queue.enqueue(q, 'list.job', {});
      const result = await queue.listByQueue(q);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().items.length).toBeGreaterThanOrEqual(2);
    });
  });
}
