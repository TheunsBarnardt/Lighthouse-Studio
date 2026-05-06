import type { Filter } from '../data/index.js';

import { getRuntime } from '../runtime/index.js';
import { uuidv4 } from '../util.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChangeOperation = 'insert' | 'update' | 'delete';
export type ChannelStatus = 'pending' | 'connected' | 'disconnected' | 'error';
import type { Unsubscribe } from '../shared-types.js';
export type { Unsubscribe };

export interface RealtimeEvent<TRow> {
  operation: ChangeOperation;
  new: TRow | null;
  old: TRow | null;
  occurredAt: Date;
  position: string;
}

// ── WebSocket message protocol ────────────────────────────────────────────────

interface WsMessage {
  type: string;
  channelId?: string;
  payload?: unknown;
}

interface SubscribeMsg {
  type: 'subscribe';
  channelId: string;
  table: string;
  workspace: string;
  schema: string;
  filter?: unknown;
  fields?: string[] | undefined;
  snapshot?: boolean | undefined;
  resumePosition?: string | undefined;
}

// ── RealtimeChannel ───────────────────────────────────────────────────────────

export class RealtimeChannel<TRow> {
  private readonly id: string = uuidv4();
  private readonly handlers = new Map<ChangeOperation, Set<(e: RealtimeEvent<TRow>) => void>>();
  private readonly statusHandlers = new Set<(s: ChannelStatus) => void>();
  private filterVal: Filter<TRow> | null = null;
  private fieldsVal: (keyof TRow)[] | null = null;
  private snapshotVal = false;
  private resumePosition: string | null = null;
  private _status: ChannelStatus = 'pending';
  private readonly buffer: RealtimeEvent<TRow>[] = [];
  private readonly maxBuffer = 1000;

  constructor(
    readonly table: string,
    readonly workspace: string,
    readonly schema: string,
    private readonly manager: RealtimeManager,
  ) {}

  on(event: ChangeOperation, handler: (e: RealtimeEvent<TRow>) => void): this {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return this;
  }

  filter(f: Filter<TRow>): this {
    this.filterVal = f;
    return this;
  }

  fields(...fields: (keyof TRow)[]): this {
    this.fieldsVal = fields;
    return this;
  }

  snapshot(enabled: boolean): this {
    this.snapshotVal = enabled;
    return this;
  }

  status(): ChannelStatus {
    return this._status;
  }

  onStatusChange(handler: (s: ChannelStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  async subscribe(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.manager.register(this as unknown as RealtimeChannel<any>);
    await this.manager.connect();
    this.manager.sendSubscribe(this.buildSubscribeMsg());
  }

  unsubscribe(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.manager.unregister(this as unknown as RealtimeChannel<any>);
    this.manager.send({ type: 'unsubscribe', channelId: this.id });
  }

  // ── Internal API used by RealtimeManager ──────────────────────────────────

  get channelId(): string {
    return this.id;
  }

  setStatus(s: ChannelStatus): void {
    this._status = s;
    for (const h of Array.from(this.statusHandlers)) {
      try {
        h(s);
      } catch {
        /* noop */
      }
    }
  }

  dispatch(event: RealtimeEvent<TRow>): void {
    // Backpressure: drop oldest if buffer full
    if (this.buffer.length >= this.maxBuffer) this.buffer.shift();
    this.buffer.push(event);

    const set = this.handlers.get(event.operation);
    if (!set) return;
    for (const h of Array.from(set)) {
      try {
        h(event);
      } catch {
        /* listener errors don't affect SDK */
      }
    }
  }

  buildSubscribeMsg(): SubscribeMsg {
    return {
      type: 'subscribe',
      channelId: this.id,
      table: this.table,
      workspace: this.workspace,
      schema: this.schema,
      filter: this.filterVal ?? undefined,
      fields: this.fieldsVal?.map(String) ?? undefined,
      snapshot: this.snapshotVal || undefined,
      resumePosition: this.resumePosition ?? undefined,
    };
  }

  updateResumePosition(pos: string): void {
    this.resumePosition = pos;
  }
}

// ── RealtimeManager — one WS per PlatformClient ───────────────────────────────

interface RealtimeManagerOptions {
  wsUrl: string;
  getToken: () => string | null;
}

export class RealtimeManager {
  private ws: WebSocket | null = null;
  private readonly channels = new Map<string, RealtimeChannel<unknown>>();
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private closed = false;
  private readonly pendingMessages: WsMessage[] = [];

  constructor(private readonly opts: RealtimeManagerOptions) {}

  register(channel: RealtimeChannel<unknown>): void {
    this.channels.set(channel.channelId, channel);
  }

  unregister(channel: RealtimeChannel<unknown>): void {
    this.channels.delete(channel.channelId);
    if (this.channels.size === 0) this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === 1 /* OPEN */) return;
    if (this.connecting) return;
    this.connecting = true;

    return new Promise((resolve, reject) => {
      const { WebSocket: WsCtor } = getRuntime();
      const token = this.opts.getToken();
      const url = token ? `${this.opts.wsUrl}?token=${encodeURIComponent(token)}` : this.opts.wsUrl;

      const ws = new WsCtor(url);
      this.ws = ws as unknown as WebSocket;

      ws.onopen = () => {
        this.connecting = false;
        this.reconnectAttempt = 0;

        // Flush pending messages
        for (const msg of this.pendingMessages) {
          ws.send(JSON.stringify(msg));
        }
        this.pendingMessages.length = 0;

        // Re-subscribe all active channels
        for (const ch of Array.from(this.channels.values())) {
          ch.setStatus('connected');
          ws.send(JSON.stringify(ch.buildSubscribeMsg()));
        }

        resolve();
      };

      ws.onclose = () => {
        this.connecting = false;
        for (const ch of Array.from(this.channels.values())) ch.setStatus('disconnected');
        if (!this.closed) this.scheduleReconnect();
      };

      ws.onerror = () => {
        this.connecting = false;
        for (const ch of Array.from(this.channels.values())) ch.setStatus('error');
        reject(new Error('WebSocket connection failed'));
      };

      ws.onmessage = (evt: MessageEvent) => {
        try {
          const msg = JSON.parse(evt.data as string) as WsMessage;
          this.handleMessage(msg);
        } catch {
          /* malformed message */
        }
      };
    });
  }

  send(msg: WsMessage): void {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.pendingMessages.push(msg);
    }
  }

  sendSubscribe(msg: SubscribeMsg): void {
    this.send(msg as unknown as WsMessage);
  }

  disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private handleMessage(msg: WsMessage): void {
    if (msg.type === 'event' && msg.channelId) {
      const channel = this.channels.get(msg.channelId);
      if (channel) {
        const payload = msg.payload as {
          operation: ChangeOperation;
          new: unknown;
          old: unknown;
          occurredAt: string;
          position: string;
        };
        channel.dispatch({
          operation: payload.operation,
          new: payload.new as never,
          old: payload.old as never,
          occurredAt: new Date(payload.occurredAt),
          position: payload.position,
        });
        channel.updateResumePosition(payload.position);
      }
    } else if (msg.type === 'ping') {
      this.send({ type: 'pong' });
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(300 * 2 ** this.reconnectAttempt, 30_000);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => {
        /* will retry again */
      });
    }, delay);
  }
}

// ── createRealtimeChannel factory ─────────────────────────────────────────────

export function createRealtimeChannel<TRow>(
  table: string,
  workspace: string,
  schema: string,
  manager: RealtimeManager,
): RealtimeChannel<TRow> {
  return new RealtimeChannel<TRow>(table, workspace, schema, manager);
}
