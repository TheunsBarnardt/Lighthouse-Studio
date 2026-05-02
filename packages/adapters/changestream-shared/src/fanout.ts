import type { LoggerPort, MetricsPort } from '@platform/ports-observability';
import type {
  ChangeEvent,
  ErrorChangeEvent,
  GapChangeEvent,
  SubscribeOptions,
} from '@platform/ports-persistence';

// ── Subscriber slot ───────────────────────────────────────────────────────────

interface SubscriberSlot {
  readonly id: string;
  readonly tables: ReadonlySet<string> | null; // null = all tables
  readonly buffer: ChangeEvent[];
  readonly bufferSize: number;
  droppedCount: number;
  sequenceNumber: bigint;
  resolve: (() => void) | null; // wakes the consumer goroutine
  done: boolean;
}

// ── Fan-out manager ───────────────────────────────────────────────────────────

/**
 * In-process fan-out for change events.
 *
 * One source stream connects to the database; many subscribers each get their
 * own bounded buffer. When a subscriber's buffer is full, the oldest event is
 * dropped and a GapChangeEvent is queued in its place on the next delivery.
 *
 * This is explicitly "at-least-once" — subscribers are expected to be idempotent.
 */
export class ChangeStreamFanout {
  private readonly subscribers = new Map<string, SubscriberSlot>();
  private closed = false;
  private readonly logger: LoggerPort | undefined;
  private readonly metrics: MetricsPort | undefined;

  constructor(deps?: { logger?: LoggerPort; metrics?: MetricsPort }) {
    this.logger = deps?.logger;
    this.metrics = deps?.metrics;
  }

  /**
   * Publish a change event to all matching subscribers.
   * Called by the source adapter for each incoming event.
   */
  publish(event: ChangeEvent): void {
    if (this.closed) return;

    for (const slot of this.subscribers.values()) {
      if (slot.done) continue;
      if (slot.tables !== null && event.kind !== 'error' && event.kind !== 'gap') {
        const tableEvent = event as { table?: string };
        if (tableEvent.table && !slot.tables.has(tableEvent.table)) continue;
      }

      if (slot.buffer.length >= slot.bufferSize) {
        // Buffer overflow — drop oldest, record a gap
        slot.buffer.shift();
        slot.droppedCount += 1;
        this.metrics
          ?.counter('platform_changestream_buffer_overflow_total', {
            description: 'Number of change events dropped due to buffer overflow',
          })
          .add(1);
        this.logger?.warn('Change stream buffer overflow; event dropped', {
          subscriberId: slot.id,
          droppedCount: slot.droppedCount,
        });
      }

      if (slot.droppedCount > 0 && event.kind !== 'gap') {
        // Inject a gap event before the next real event
        const gap: GapChangeEvent = {
          kind: 'gap',
          droppedCount: slot.droppedCount,
          sequenceNumber: event.sequenceNumber,
          detectedAt: new Date(),
          resumeToken: event.resumeToken,
        };
        slot.buffer.push(gap);
        slot.droppedCount = 0;
      }

      slot.buffer.push(event);
      slot.resolve?.();
      slot.resolve = null;
    }
  }

  /**
   * Terminate all subscribers with a fatal error event then close the fan-out.
   */
  terminate(error: Error): void {
    if (this.closed) return;
    this.closed = true;

    const fatalEvent: ErrorChangeEvent = {
      kind: 'error',
      error,
      fatal: true,
      sequenceNumber: BigInt(0),
      detectedAt: new Date(),
      resumeToken: '',
    };

    for (const slot of this.subscribers.values()) {
      slot.buffer.push(fatalEvent);
      slot.done = true;
      slot.resolve?.();
      slot.resolve = null;
    }
  }

  close(): void {
    this.closed = true;
    for (const slot of this.subscribers.values()) {
      slot.done = true;
      slot.resolve?.();
      slot.resolve = null;
    }
  }

  /**
   * Create an AsyncIterable<ChangeEvent> for a new subscriber.
   * The iterable terminates when:
   *   - the caller breaks out of the for-await loop, or
   *   - the fan-out is closed/terminated.
   */
  createSubscription(opts: SubscribeOptions = {}): AsyncIterable<ChangeEvent> {
    const id = crypto.randomUUID();
    const tables = opts.tables && opts.tables.length > 0 ? new Set(opts.tables) : null;
    const bufferSize = opts.bufferSize ?? 1_000;

    const slot: SubscriberSlot = {
      id,
      tables,
      buffer: [],
      bufferSize,
      droppedCount: 0,
      sequenceNumber: BigInt(0),
      resolve: null,
      done: this.closed,
    };

    this.subscribers.set(id, slot);
    this.logger?.debug('Change stream subscriber added', { subscriberId: id });

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const fanout = this;

    return {
      [Symbol.asyncIterator](): AsyncIterator<ChangeEvent> {
        return {
          async next(): Promise<IteratorResult<ChangeEvent>> {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            while (true) {
              const event = slot.buffer.shift();
              if (event !== undefined) {
                return { value: event, done: false };
              }
              if (slot.done) {
                fanout.subscribers.delete(id);
                return { value: undefined as unknown as ChangeEvent, done: true };
              }
              // Wait for the next publish
              await new Promise<void>((resolve) => {
                slot.resolve = resolve;
              });
            }
          },
          return(): Promise<IteratorResult<ChangeEvent>> {
            slot.done = true;
            if (slot.resolve) {
              slot.resolve();
            }
            slot.resolve = null;
            fanout.subscribers.delete(id);
            fanout.logger?.debug('Change stream subscriber removed', { subscriberId: id });
            return Promise.resolve({ value: undefined as unknown as ChangeEvent, done: true });
          },
        };
      },
    };
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}
