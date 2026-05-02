import type { Result } from 'neverthrow';

import type { JobError } from './errors.js';
import type { EnqueueOptions, JobRecord, JobStatus } from './types.js';

export type JobHandler<T = unknown> = (job: JobRecord<T>) => Promise<void>;

export interface JobQueuePort {
  enqueue<T>(
    queue: string,
    type: string,
    payload: T,
    opts?: EnqueueOptions,
  ): Promise<Result<JobRecord<T>, JobError>>;

  register<T>(queue: string, type: string, handler: JobHandler<T>): void;

  findById(jobId: string): Promise<Result<JobRecord | null, JobError>>;

  cancel(jobId: string): Promise<Result<void, JobError>>;

  listByQueue(
    queue: string,
    opts?: { status?: JobStatus; limit?: number; offset?: number },
  ): Promise<Result<{ items: JobRecord[]; total: number }, JobError>>;

  start(): Promise<void>;
  stop(): Promise<void>;
}
