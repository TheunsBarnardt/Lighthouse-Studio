import type { PlatformClient } from '@platform/sdk';

import { provide, inject } from 'vue';

const PLATFORM_CLIENT_KEY = Symbol('platform-client');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function providePlatformClient(client: PlatformClient<any>): void {
  provide(PLATFORM_CLIENT_KEY, client);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function injectPlatformClient<TDatabase = any>(): PlatformClient<TDatabase> {
  const client = inject<PlatformClient<TDatabase>>(PLATFORM_CLIENT_KEY);
  if (!client) {
    throw new Error(
      '[platform-sdk] injectPlatformClient must be called inside a component with providePlatformClient',
    );
  }
  return client;
}
