import type { Result } from 'neverthrow';

import type { EventingError } from './errors.js';
import type { EventHandler, PublishOptions, SubscribeOptions, Subscription } from './types.js';

export interface EventBusPort {
  publish<T>(topic: string, event: T, opts?: PublishOptions): Promise<Result<void, EventingError>>;

  subscribe<T>(
    topic: string,
    handler: EventHandler<T>,
    opts?: SubscribeOptions,
  ): Promise<Result<Subscription, EventingError>>;
}
