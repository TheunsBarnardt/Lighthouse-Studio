import type {
  EventBusPort,
  EventHandler,
  EventingError,
  PublishOptions,
  SubscribeOptions,
  Subscription,
} from '@platform/ports-eventing';
import type { Result } from 'neverthrow';

import { EventingError as EE } from '@platform/ports-eventing';
import { err, ok } from 'neverthrow';

export class InMemoryEventBus implements EventBusPort {
  private readonly handlers = new Map<string, Set<EventHandler<unknown>>>();

  async publish<T>(
    topic: string,
    event: T,
    _opts?: PublishOptions,
  ): Promise<Result<void, EventingError>> {
    const topicHandlers = this.handlers.get(topic);
    if (!topicHandlers) return ok(undefined);
    const context = { topic, timestamp: new Date() };
    try {
      for (const handler of topicHandlers) {
        await (handler as EventHandler<T>)(event, context);
      }
      return ok(undefined);
    } catch (e) {
      return err(new EE('PUBLISH_FAILED', `Handler threw: ${String(e)}`, e));
    }
  }

  subscribe<T>(
    topic: string,
    handler: EventHandler<T>,
    _opts?: SubscribeOptions,
  ): Promise<Result<Subscription, EventingError>> {
    let topicHandlers = this.handlers.get(topic);
    if (!topicHandlers) {
      topicHandlers = new Set();
      this.handlers.set(topic, topicHandlers);
    }
    const typedHandler = handler as EventHandler<unknown>;
    topicHandlers.add(typedHandler);

    const subscription: Subscription = {
      unsubscribe: () => {
        this.handlers.get(topic)?.delete(typedHandler);
        return Promise.resolve();
      },
    };
    return Promise.resolve(ok(subscription));
  }
}
