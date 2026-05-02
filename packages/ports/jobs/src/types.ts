import { z } from 'zod';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobRecord<T = unknown> {
  id: string;
  queue: string;
  type: string;
  payload: T;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: string;
  createdAt: Date;
}

export interface EnqueueOptions {
  delay?: number;
  maxAttempts?: number;
  priority?: number;
  runAt?: Date;
}

export interface ScheduledJob {
  id: string;
  name: string;
  cron: string;
  queue: string;
  type: string;
  payload: unknown;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

export const EnqueueOptionsSchema = z.object({
  delay: z.number().int().min(0).optional(),
  maxAttempts: z.number().int().min(1).max(100).optional(),
  priority: z.number().int().optional(),
  runAt: z.date().optional(),
});
