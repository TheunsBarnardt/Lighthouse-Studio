# @platform/ports-prd-persistence

Port package for PRD persistence repository interfaces (Objective 22).

## Repository interfaces

Three interfaces are re-exported from `@platform/core`:

| Interface               | Responsibility                                          |
| ----------------------- | ------------------------------------------------------- |
| `PrdArtifactRepository` | CRUD for the top-level `PrdArtifact` envelope           |
| `PrdSectionRepository`  | CRUD + query-by-PRD for individual `PrdSection` records |
| `PrdTemplateRepository` | CRUD + query-by-workspace for `PrdTemplate` records     |

Import them:

```typescript
import type { PrdArtifactRepository, PrdSectionRepository, PrdTemplateRepository } from '@platform/ports-prd-persistence';
```

## Running conformance tests in an adapter package

Each conformance suite receives a factory function that returns a fresh
repository instance. The suite creates and tears down its own data; no shared
state is needed.

```typescript
// In your adapter's test file, e.g. prd-artifact-repository.test.ts
import { runPrdArtifactRepositoryConformance } from '@platform/ports-prd-persistence/conformance';
import { MyPrdArtifactRepository } from '../src/my-prd-artifact-repository.js';
import { createTestDatabase } from './helpers/test-db.js';

runPrdArtifactRepositoryConformance(() => {
  const db = createTestDatabase();
  return new MyPrdArtifactRepository(db);
});
```

The three available functions:

```typescript
import { runPrdArtifactRepositoryConformance, runPrdSectionRepositoryConformance, runPrdTemplateRepositoryConformance } from '@platform/ports-prd-persistence/conformance';
```

Each adapter package should run all three suites that apply to it. In-memory
adapters used in unit tests should also pass this suite.
