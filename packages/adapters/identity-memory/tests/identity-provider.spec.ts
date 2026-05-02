import { runIdentityProviderConformance } from '@platform/ports-identity/conformance';

import { InMemoryIdentityProvider } from '../src/index.js';

runIdentityProviderConformance('InMemoryIdentityProvider', () =>
  Promise.resolve(new InMemoryIdentityProvider()),
);
