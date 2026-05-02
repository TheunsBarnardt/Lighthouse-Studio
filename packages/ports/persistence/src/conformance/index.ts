export { runRepositoryConformance } from './repository.js';
export type { RepositoryTestFixture } from './repository.js';
export {
  runCrossAdapterConformanceSuite,
  withAllAdapters,
  makeEntity,
  assertOk,
} from './cross-adapter.js';
export type { AdapterDescriptor, TestEntity } from './cross-adapter.js';
