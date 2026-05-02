import { runSecretStoreConformance } from '@platform/ports-config/conformance';

import { InMemorySecretStore } from '../src/index.js';

runSecretStoreConformance('InMemorySecretStore', () => Promise.resolve(new InMemorySecretStore()));
