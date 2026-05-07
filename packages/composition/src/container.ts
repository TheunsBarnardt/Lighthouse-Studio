import type { AIProviderPort } from '@platform/ports-ai';
import type { AuditPort } from '@platform/ports-audit';
import type { EmailPort } from '@platform/ports-communication';
import type { SecretStorePort, FeatureFlagPort } from '@platform/ports-config';
import type { EventBusPort, ChangeStreamPort } from '@platform/ports-eventing';
import type {
  IdentityProviderPort,
  UserDirectoryPort,
  SessionPort,
} from '@platform/ports-identity';
import type { JobQueuePort, SchedulerPort } from '@platform/ports-jobs';
import type {
  ErrorReporterPort,
  LoggerPort,
  MetricsPort,
  TracerPort,
} from '@platform/ports-observability';
import type {
  RepositoryPort,
  UnitOfWorkPort,
  SchemaIntrospectionPort,
  SchemaDdlPort,
  SchemaMigrationPort,
  QueryPort,
  CustomerRepositoryProviderPort,
} from '@platform/ports-persistence';
import type { RateLimiterPort } from '@platform/ports-rate-limiter';
import type { FullTextSearchPort, VectorStorePort, EmbeddingPort } from '@platform/ports-search';
import type { ObjectStoragePort } from '@platform/ports-storage';

export interface PersistenceBundle {
  unitOfWork: UnitOfWorkPort;
  schemaIntrospection: SchemaIntrospectionPort | null;
  schemaDdl: SchemaDdlPort | null;
  schemaMigration: SchemaMigrationPort | null;
  query: QueryPort | null;
  /** Factory for creating a repository for a given entity type. */
  repository: <TEntity extends { id: string }>(entityName: string) => RepositoryPort<TEntity>;
  /** Provider for dynamic customer table repositories (used by the data API). */
  customerRepositoryProvider: CustomerRepositoryProviderPort | null;
}

export interface PlatformContainer {
  persistence: PersistenceBundle;
  rateLimiter: RateLimiterPort;
  identity: IdentityProviderPort;
  userDirectory: UserDirectoryPort | null;
  session: SessionPort | null;
  storage: ObjectStoragePort;
  email: EmailPort;
  eventBus: EventBusPort;
  changeStream: ChangeStreamPort | null;
  fullTextSearch: FullTextSearchPort;
  vectorStore: VectorStorePort | null;
  embeddings: EmbeddingPort | null;
  ai: AIProviderPort;
  jobs: JobQueuePort;
  scheduler: SchedulerPort | null;
  audit: AuditPort;
  logger: LoggerPort;
  metrics: MetricsPort;
  tracer: TracerPort;
  errorReporter: ErrorReporterPort;
  secrets: SecretStorePort;
  featureFlags: FeatureFlagPort | null;
}
