import type { Result } from 'neverthrow';

import type { JobError } from './errors.js';
import type { ScheduledJob } from './types.js';

export interface SchedulerPort {
  register(
    job: Omit<ScheduledJob, 'lastRunAt' | 'nextRunAt'>,
  ): Promise<Result<ScheduledJob, JobError>>;
  unregister(jobId: string): Promise<Result<void, JobError>>;
  enable(jobId: string): Promise<Result<void, JobError>>;
  disable(jobId: string): Promise<Result<void, JobError>>;
  list(): Promise<Result<ScheduledJob[], JobError>>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
