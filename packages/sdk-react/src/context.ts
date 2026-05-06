import type { PlatformClient } from '@platform/sdk';
import type { ReactNode } from 'react';

import { createContext, useContext, createElement } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PlatformContext = createContext<PlatformClient<any> | null>(null);

export interface PlatformProviderProps {
  client: PlatformClient;
  children: ReactNode;
}

export function PlatformProvider({ client, children }: PlatformProviderProps) {
  return createElement(PlatformContext.Provider, { value: client }, children);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePlatformClient<TDatabase = any>(): PlatformClient<TDatabase> {
  const client = useContext(PlatformContext);
  if (!client) {
    throw new Error('[platform-sdk] usePlatformClient must be used inside <PlatformProvider>');
  }
  return client as PlatformClient<TDatabase>;
}
