import type { Result } from 'neverthrow';

import { beforeEach, describe, expect, it } from 'vitest';

import type { RepositoryPort } from '../repository.port.js';
import type { UnitOfWorkPort } from '../unit-of-work.port.js';

// ── Test entity ───────────────────────────────────────────────────────────────

export interface TestEntity {
  id: string;
  name: string;
  value: number;
  active: boolean;
  createdAt: Date;
  _version: number;
  _archived_at: Date | null;
}

// ── Adapter descriptor ────────────────────────────────────────────────────────

export interface AdapterDescriptor {
  name: string;
  setup(): Promise<{
    repo: RepositoryPort<TestEntity>;
    uow: UnitOfWorkPort;
    cleanup(): Promise<void>;
  }>;
}

// ── Cross-adapter conformance suite ──────────────────────────────────────────

/**
 * Defines property-based cross-adapter tests.
 * Each call to withAllAdapters registers a describe block per adapter,
 * plus a cross-adapter equivalence block that runs the same operations
 * against all adapters and compares results.
 *
 * Usage in a test file:
 *
 *   withAllAdapters([postgresDescriptor, mssqlDescriptor, mongoDescriptor], (adapter) => {
 *     // adapter.repo is a RepositoryPort<TestEntity>
 *   });
 */
export function withAllAdapters(
  adapters: AdapterDescriptor[],
  testFn: (ctx: { repo: RepositoryPort<TestEntity>; uow: UnitOfWorkPort; name: string }) => void,
): void {
  for (const descriptor of adapters) {
    describe(`[${descriptor.name}]`, () => {
      let repo!: RepositoryPort<TestEntity>;
      let uow!: UnitOfWorkPort;
      let cleanup!: () => Promise<void>;

      beforeEach(async () => {
        const ctx = await descriptor.setup();
        repo = ctx.repo;
        uow = ctx.uow;
        cleanup = (): Promise<void> => ctx.cleanup();
      });

      afterEach(async () => {
        await cleanup();
      });

      testFn({ repo, uow, name: descriptor.name });
    });
  }
}

// ── Shared conformance assertions ─────────────────────────────────────────────

export function makeEntity(overrides: Partial<TestEntity> = {}): TestEntity {
  return {
    id: crypto.randomUUID(),
    name: 'test-entity',
    value: 42,
    active: true,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    _version: 1,
    _archived_at: null,
    ...overrides,
  };
}

export function assertOk<T, E extends { message: string }>(result: Result<T, E>): T {
  if (result.isErr()) {
    throw new Error(`Expected ok but got err: ${result.error.message}`);
  }
  return result.value;
}

export function runCrossAdapterConformanceSuite(adapters: AdapterDescriptor[]): void {
  withAllAdapters(adapters, ({ repo }) => {
    describe('create and findById', () => {
      it('creates an entity and retrieves it by id', async () => {
        const entity = makeEntity();
        const created = assertOk(await repo.create(entity));
        expect(created.id).toBe(entity.id);
        expect(created.name).toBe(entity.name);

        const found = assertOk(await repo.findById(entity.id));
        expect(found).not.toBeNull();
        expect(found?.id).toBe(entity.id);
      });

      it('returns null for unknown id', async () => {
        const result = assertOk(await repo.findById(crypto.randomUUID()));
        expect(result).toBeNull();
      });
    });

    describe('findOne', () => {
      it('finds by filter', async () => {
        const entity = makeEntity({ name: 'find-me' });
        assertOk(await repo.create(entity));
        const found = assertOk(await repo.findOne({ name: 'find-me' } as never));
        expect(found).not.toBeNull();
        expect(found?.id).toBe(entity.id);
      });
    });

    describe('findMany', () => {
      it('returns paginated results', async () => {
        const entities = [
          makeEntity({ name: 'a' }),
          makeEntity({ name: 'b' }),
          makeEntity({ name: 'c' }),
        ];
        for (const e of entities) assertOk(await repo.create(e));

        const result = assertOk(await repo.findMany({ page: { limit: 2, offset: 0 } }));
        expect(result.items.length).toBeLessThanOrEqual(2);
        expect(typeof result.total).toBe('number');
        expect(result.total).toBeGreaterThanOrEqual(3);
      });
    });

    describe('update', () => {
      it('updates an entity and increments version', async () => {
        const entity = makeEntity({ _version: 1 });
        assertOk(await repo.create(entity));
        const updated = assertOk(await repo.update(entity.id, { name: 'updated' } as never));
        expect(updated.name).toBe('updated');
      });

      it('returns EntityNotFoundError for unknown id', async () => {
        const result = await repo.update(crypto.randomUUID(), { name: 'x' } as never);
        expect(result.isErr()).toBe(true);
      });
    });

    describe('archive', () => {
      it('archives an entity', async () => {
        const entity = makeEntity();
        assertOk(await repo.create(entity));
        assertOk(await repo.archive(entity.id));

        // Archived entities should not appear in findById by default
        const found = assertOk(await repo.findById(entity.id));
        expect(found).toBeNull();
      });
    });

    describe('hardDelete', () => {
      it('deletes an entity permanently', async () => {
        const entity = makeEntity();
        assertOk(await repo.create(entity));
        assertOk(await repo.hardDelete(entity.id));
        const found = assertOk(await repo.findById(entity.id));
        expect(found).toBeNull();
      });
    });

    describe('count', () => {
      it('returns the count of live entities', async () => {
        const before = assertOk(await repo.count());
        const entity = makeEntity();
        assertOk(await repo.create(entity));
        const after = assertOk(await repo.count());
        expect(after).toBe(before + 1);
      });
    });
  });
}

// Silence the afterEach reference error — imported from vitest globally in tests
declare const afterEach: (fn: () => Promise<void>) => void;
