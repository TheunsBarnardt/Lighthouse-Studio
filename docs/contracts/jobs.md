# Contract: Jobs

> Ports: `@platform/ports-jobs` — `JobQueuePort`, `SchedulerPort`

## Purpose

`JobQueuePort` provides durable, async job execution with retry semantics. Callers enqueue work; registered handlers process it. The queue manages scheduling, retries, and status tracking.

`SchedulerPort` provides cron-based recurrence. It does not run jobs itself — it enqueues jobs into a `JobQueuePort` queue on a schedule. `SchedulerPort` is nullable in the container; components that rely on it must guard against its absence.

Both ports abstract over concrete backends (in-memory, Postgres-polling, BullMQ). Application code never depends on the backend directly.

---

## Types

```typescript
type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface JobRecord<T = unknown> {
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

interface EnqueueOptions {
  runAt?: Date; // Delay execution until this time
  maxAttempts?: number; // Default: adapter-defined (typically 3)
  deduplicationKey?: string; // Prevent duplicate jobs with the same key
}

type JobHandler<T> = (job: JobRecord<T>) => Promise<Result<void, unknown>>;

interface ScheduleOptions {
  id: string; // Caller-assigned stable identifier
  cron: string; // Standard cron expression (5 or 6 fields)
  queue: string;
  type: string;
  payload?: unknown;
  timezone?: string; // IANA timezone name; defaults to UTC
}

interface ScheduledJob {
  id: string;
  cron: string;
  queue: string;
  type: string;
  nextRunAt: Date;
  enabled: boolean;
}

type JobErrorCode = 'ENQUEUE_FAILED' | 'NOT_FOUND' | 'ALREADY_CANCELLED' | 'UNKNOWN';
```

---

## Methods

### `JobQueuePort`

#### `enqueue<T>(queue, type, payload, opts?): Promise<Result<JobRecord<T>, JobError>>`

Creates a job and adds it to the named queue. The job is immediately visible to workers (subject to `runAt`).

**Pre-conditions:**

- `queue` and `type` are non-empty strings.
- If `opts.deduplicationKey` is set and a non-completed, non-cancelled job with that key already exists in the queue, the adapter MAY return the existing job rather than creating a new one. Callers must not rely on a new job being created when a deduplication key is provided.

**Post-conditions:**

- Returns `ok(JobRecord)` with `status: 'pending'` and `scheduledAt` set to `opts.runAt` or the current time.
- On failure (e.g., backend unavailable), returns `err({ code: 'ENQUEUE_FAILED', ... })`.
- Does not execute the handler synchronously.

---

#### `register<T>(queue, type, handler): void`

Binds a handler function to jobs of the given type on the given queue. The adapter invokes this handler for each matching job once `start()` has been called.

**Pre-conditions:**

- Called before `start()`. Registering after `start()` has implementation-defined behaviour; do not rely on it.
- Each `(queue, type)` pair should be registered at most once per process. Duplicate registrations are not an error but the behaviour (last-wins vs. both-called) is adapter-defined.

**Post-conditions:**

- The handler will be invoked with matching `JobRecord` instances during the lifetime of the running queue.
- If the handler returns `err(...)`, the adapter treats the attempt as failed and schedules a retry (up to `maxAttempts`). If the handler throws, the adapter catches the exception and also treats it as a failed attempt.

**In-memory adapter note:** `register` is a no-op. Registered handlers are never called. This is intentional — the in-memory adapter is for tests that verify enqueueing, not execution.

---

#### `findById(jobId): Promise<Result<JobRecord | null, JobError>>`

Retrieves a single job by its adapter-assigned ID.

**Pre-conditions:** `jobId` is non-empty.

**Post-conditions:**

- Returns `ok(JobRecord)` if found, `ok(null)` if not found.
- Returns `err({ code: 'NOT_FOUND', ... })` only in cases where the adapter cannot determine whether the job exists (e.g., storage error). A clean miss is `ok(null)`, not an error.

---

#### `cancel(jobId): Promise<Result<void, JobError>>`

Marks a pending job as cancelled. Cancellation is best-effort for `running` jobs — the handler may have already started.

**Pre-conditions:** `jobId` is non-empty.

**Post-conditions:**

- If the job is `pending`, it transitions to `cancelled` and will not be executed.
- If the job is already `cancelled` or `completed`, returns `err({ code: 'ALREADY_CANCELLED', ... })`.
- If the job is `running`, behaviour is adapter-defined. The in-progress execution is not interrupted, but the job will not be retried.
- If the job does not exist, returns `err({ code: 'NOT_FOUND', ... })`.

---

#### `listByQueue(queue, opts?): Promise<Result<{ items: JobRecord[]; total: number }, JobError>>`

Returns a paginated list of jobs for the named queue.

**Pre-conditions:** `queue` is non-empty. `opts.limit` defaults to an adapter-defined value (typically 50). `opts.offset` defaults to 0.

**Post-conditions:**

- Returns `ok({ items, total })` where `total` is the count matching the filter before pagination.
- Filtering by `status` is additive to the queue filter — only jobs matching both queue and status are returned.
- Results are ordered by `createdAt` ascending unless the adapter specifies otherwise.

---

#### `start(): Promise<void>`

Starts the worker loop. Jobs queued before `start()` will be processed after `start()` completes.

**Pre-conditions:** All handlers should be registered before calling `start()`.

**Post-conditions:**

- The adapter begins polling or subscribing to the backend.
- Calling `start()` more than once on the same instance has implementation-defined behaviour; treat it as a programming error.

**In-memory adapter note:** `start()` is a no-op.

---

#### `stop(): Promise<void>`

Initiates graceful shutdown. In-progress handlers are allowed to finish; no new jobs are picked up.

**Pre-conditions:** `start()` has been called.

**Post-conditions:**

- After `stop()` resolves, no new handler invocations will occur.
- The adapter should wait for in-flight handlers to complete before resolving (up to an adapter-defined drain timeout).

**In-memory adapter note:** `stop()` is a no-op.

---

### `SchedulerPort`

#### `schedule(opts): Promise<Result<ScheduledJob, JobError>>`

Registers a recurring job that enqueues into `JobQueuePort` on the given cron schedule.

**Pre-conditions:**

- `opts.id` is caller-assigned and stable; re-scheduling with the same `id` updates the existing schedule.
- `opts.cron` is a valid 5-field or 6-field cron expression.
- `opts.queue` and `opts.type` correspond to a queue/type that has a registered handler (enforcement is advisory — no runtime check).

**Post-conditions:**

- Returns `ok(ScheduledJob)` with `nextRunAt` computed from `opts.cron` and `opts.timezone`.
- If a schedule with `opts.id` already exists, it is replaced (upsert semantics).

---

#### `unschedule(id): Promise<Result<void, JobError>>`

Removes a scheduled job by its caller-assigned ID. Any enqueued jobs already in the queue are not affected.

**Pre-conditions:** `id` is non-empty.

**Post-conditions:**

- The schedule no longer fires.
- Returns `err({ code: 'NOT_FOUND', ... })` if `id` does not exist.

---

#### `list(): Promise<Result<ScheduledJob[], JobError>>`

Returns all registered scheduled jobs.

**Post-conditions:** Returns `ok([])` when no schedules exist; never returns `ok(null)`.

---

## Capability Flags

| Flag                  | Meaning                                            |
| --------------------- | -------------------------------------------------- |
| `jobs.deduplication`  | Adapter supports `EnqueueOptions.deduplicationKey` |
| `jobs.scheduler`      | `SchedulerPort` is configured and non-null         |
| `jobs.priorityQueues` | Adapter supports priority ordering within a queue  |

---

## Performance Expectations

| Operation                                 | Target latency                |
| ----------------------------------------- | ----------------------------- |
| `enqueue` (Postgres adapter)              | < 50 ms p99 under normal load |
| `enqueue` (BullMQ/Redis)                  | < 10 ms p99                   |
| `findById`                                | < 20 ms p99                   |
| `listByQueue` (limit 50)                  | < 100 ms p99                  |
| Handler invocation lag (Postgres polling) | < 5 s (polling interval)      |
| Handler invocation lag (BullMQ)           | < 200 ms                      |

`SchedulerPort` cron resolution accuracy is bounded by the polling interval of the underlying scheduler. For critical timing, prefer BullMQ.

---

## Known Adapter Divergences

| Behaviour                      | In-memory                    | Postgres                   | BullMQ                   |
| ------------------------------ | ---------------------------- | -------------------------- | ------------------------ |
| `register` / handler execution | No-op; handlers never called | Executes after `start()`   | Executes after `start()` |
| `start()` / `stop()`           | No-op                        | Starts polling loop        | Starts queue workers     |
| `deduplicationKey`             | Not supported                | Supported via unique index | Supported natively       |
| Cross-process job pickup       | No                           | Yes (polling)              | Yes (pub/sub)            |
| `SchedulerPort`                | No-op (if wired)             | Postgres-based cron table  | Bull cron jobs           |
| Durability                     | None (memory)                | Full (WAL)                 | Redis persistence        |

---

## Usage Examples

```typescript
// Enqueueing a job
const result = await jobQueue.enqueue('email', 'send-welcome', { userId: ctx.actorId, workspaceId: ctx.workspaceId }, { maxAttempts: 5 });
if (result.isErr()) return err(result.error);

// Registering a handler (application startup)
jobQueue.register<{ userId: string; workspaceId: string }>('email', 'send-welcome', async (job) => {
  const sent = await emailService.sendWelcome(job.payload.userId);
  if (sent.isErr()) return err(sent.error);
  return ok(undefined);
});

// Scheduling a recurring task
const scheduled = await scheduler.schedule({
  id: 'daily-report',
  cron: '0 8 * * *',
  queue: 'reports',
  type: 'generate-daily-report',
  payload: { scope: 'all-workspaces' },
  timezone: 'Africa/Johannesburg',
});
```

---

## Common Misuse

**Calling `start()` before registering all handlers.** Jobs picked up before a handler is registered may be processed without the handler, causing silent failures on some adapters. Register all handlers first, then call `start()`.

**Assuming `register()` wires execution in tests.** The in-memory adapter does not execute handlers. Tests that verify side effects of job execution must use a real adapter or call the handler function directly.

**Not calling `stop()` on process exit.** Omitting `stop()` leaves in-flight handlers in an unknown state and may cause jobs to be re-attempted unnecessarily. Wire `stop()` into your process shutdown hook.

**Writing handler logic inside `enqueue` callers.** Handler logic belongs in the registered handler, not at the call site. The `enqueue` caller does not know when or by which process the job will execute.

**Using `SchedulerPort` without null-checking.** `SchedulerPort` is nullable in the container. Components that use it must check for null at startup and fail clearly rather than panic at runtime.

**Relying on job ordering across queues.** Jobs within a queue are processed in approximate order, but there is no cross-queue ordering guarantee. Model dependencies between jobs using chaining (one job enqueues the next) rather than relying on timing.
