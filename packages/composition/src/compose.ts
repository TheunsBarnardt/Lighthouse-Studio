import { EchoAiAdapter } from '@platform/adapter-ai-memory';
import { InMemoryAuditPort } from '@platform/adapter-audit-memory';
import { InMemoryEmailPort } from '@platform/adapter-communication-memory';
import { InMemorySecretStore } from '@platform/adapter-config-memory';
import { InMemoryEventBus } from '@platform/adapter-eventing-memory';
import { InMemoryIdentityProvider } from '@platform/adapter-identity-memory';
import { InMemoryJobQueue } from '@platform/adapter-jobs-memory';
import {
  NoopErrorReporter,
  NoopLogger,
  NoopMetrics,
  NoopTracer,
} from '@platform/adapter-observability-memory';
import { InMemoryRepository, InMemoryUnitOfWork } from '@platform/adapter-persistence-memory';
import { InMemoryFullTextSearch } from '@platform/adapter-search-memory';
import { InMemoryObjectStorage } from '@platform/adapter-storage-memory';

import type { PlatformContainer } from './container.js';

export function composeMemory(): PlatformContainer {
  const repositories = new Map<string, InMemoryRepository<{ id: string }>>();

  return {
    persistence: {
      unitOfWork: new InMemoryUnitOfWork(),
      schemaIntrospection: null,
      schemaDdl: null,
      schemaMigration: null,
      query: null,
      repository: <TEntity extends { id: string }>(entityName: string) => {
        if (!repositories.has(entityName)) {
          repositories.set(entityName, new InMemoryRepository<TEntity>());
        }
        return repositories.get(entityName) as InMemoryRepository<TEntity>;
      },
    },
    identity: new InMemoryIdentityProvider(),
    userDirectory: null,
    session: null,
    storage: new InMemoryObjectStorage(),
    email: new InMemoryEmailPort(),
    eventBus: new InMemoryEventBus(),
    changeStream: null,
    fullTextSearch: new InMemoryFullTextSearch(),
    vectorStore: null,
    embeddings: null,
    ai: new EchoAiAdapter(),
    jobs: new InMemoryJobQueue(),
    scheduler: null,
    audit: new InMemoryAuditPort(),
    logger: new NoopLogger(),
    metrics: new NoopMetrics(),
    tracer: new NoopTracer(),
    errorReporter: new NoopErrorReporter(),
    secrets: new InMemorySecretStore(),
    featureFlags: null,
  };
}
