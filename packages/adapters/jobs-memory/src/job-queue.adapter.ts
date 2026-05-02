import type {
  EnqueueOptions,
  JobError,
  JobHandler,
  JobQueuePort,
  JobRecord,
  JobStatus,
} from '@platform/ports-jobs';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

export class InMemoryJobQueue implements JobQueuePort {
  private readonly jobs = new Map<string, JobRecord>();

  enqueue<T>(
    queue: string,
    type: string,
    payload: T,
    opts?: EnqueueOptions,
  ): Promise<Result<JobRecord<T>, JobError>> {
    const job: JobRecord<T> = {
      id: crypto.randomUUID(),
      queue,
      type,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: opts?.maxAttempts ?? 3,
      scheduledAt: opts?.runAt ?? new Date(),
      createdAt: new Date(),
    };
    this.jobs.set(job.id, job as JobRecord);
    return Promise.resolve(ok(job));
  }

  register<T>(_queue: string, _type: string, _handler: JobHandler<T>): void {}

  findById(jobId: string): Promise<Result<JobRecord | null, JobError>> {
    return Promise.resolve(ok(this.jobs.get(jobId) ?? null));
  }

  cancel(jobId: string): Promise<Result<void, JobError>> {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.set(jobId, { ...job, status: 'cancelled' });
    }
    return Promise.resolve(ok(undefined));
  }

  listByQueue(
    queue: string,
    opts?: { status?: JobStatus; limit?: number; offset?: number },
  ): Promise<Result<{ items: JobRecord[]; total: number }, JobError>> {
    let items = Array.from(this.jobs.values()).filter((j) => j.queue === queue);
    if (opts?.status) items = items.filter((j) => j.status === opts.status);
    const total = items.length;
    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;
    return Promise.resolve(ok({ items: items.slice(offset, offset + limit), total }));
  }

  start(): Promise<void> {
    return Promise.resolve();
  }
  stop(): Promise<void> {
    return Promise.resolve();
  }
}
