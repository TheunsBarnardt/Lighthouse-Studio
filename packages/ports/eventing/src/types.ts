export interface PublishOptions {
  key?: string;
  headers?: Record<string, string>;
}

export interface SubscribeOptions {
  group?: string;
  fromBeginning?: boolean;
}

export interface EventContext {
  topic: string;
  timestamp: Date;
  headers?: Record<string, string>;
}

export interface Subscription {
  unsubscribe(): Promise<void>;
}

export type EventHandler<T> = (event: T, context: EventContext) => Promise<void>;

export type ChangeOperation = 'insert' | 'update' | 'delete' | 'truncate';

export type ChangeStreamFeature =
  | 'before_after_image'
  | 'server_side_filter'
  | 'replay_from_position';

export interface ChangeEvent {
  table: string;
  schema?: string;
  operation: ChangeOperation;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  occurredAt: Date;
  position: string;
}

export interface WatchOptions {
  schema?: string;
  table: string;
  operations?: ChangeOperation[];
}
