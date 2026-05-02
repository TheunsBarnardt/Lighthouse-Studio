import { describe, expect, it } from 'vitest';

import type { RepositoryPort } from '../repository.port.js';

export interface RepositoryTestFixture<T extends { id: string }> {
  makeEntity(overrides?: Partial<T>): T;
  makeId(): string;
}

export function runRepositoryConformance<T extends { id: string; archivedAt?: Date | null }>(
  name: string,
  factory: () => Promise<RepositoryPort<T>>,
  fixture: RepositoryTestFixture<T>,
): void {
  describe(`${name} — RepositoryPort conformance`, () => {
    it('findById returns null for a nonexistent id', async () => {
      const repo = await factory();
      const result = await repo.findById(fixture.makeId());
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('create then findById round-trips the entity', async () => {
      const repo = await factory();
      const entity = fixture.makeEntity();
      const created = await repo.create(entity);
      expect(created.isOk()).toBe(true);
      const found = await repo.findById(entity.id);
      expect(found._unsafeUnwrap()).toMatchObject({ id: entity.id });
    });

    it('create with a duplicate id returns ConflictError', async () => {
      const repo = await factory();
      const entity = fixture.makeEntity();
      await repo.create(entity);
      const second = await repo.create(entity);
      expect(second.isErr()).toBe(true);
      expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
    });

    it('update modifies the entity', async () => {
      const repo = await factory();
      const entity = fixture.makeEntity();
      await repo.create(entity);
      const updated = await repo.update(entity.id, {} as Partial<Omit<T, 'id'>>);
      expect(updated.isOk()).toBe(true);
    });

    it('update on nonexistent id returns EntityNotFoundError', async () => {
      const repo = await factory();
      const result = await repo.update(fixture.makeId(), {} as Partial<Omit<T, 'id'>>);
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('ENTITY_NOT_FOUND');
    });

    it('archive succeeds for an existing entity', async () => {
      const repo = await factory();
      const entity = fixture.makeEntity();
      await repo.create(entity);
      const result = await repo.archive(entity.id);
      expect(result.isOk()).toBe(true);
    });

    it('archive returns EntityNotFoundError for a nonexistent id', async () => {
      const repo = await factory();
      const result = await repo.archive(fixture.makeId());
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('ENTITY_NOT_FOUND');
    });

    it('findMany returns all created entities', async () => {
      const repo = await factory();
      const a = fixture.makeEntity();
      const b = fixture.makeEntity();
      await repo.create(a);
      await repo.create(b);
      const result = await repo.findMany({ page: { limit: 100, offset: 0 } });
      expect(result.isOk()).toBe(true);
      const ids = result._unsafeUnwrap().items.map((e) => e.id);
      expect(ids).toContain(a.id);
      expect(ids).toContain(b.id);
    });

    it('findMany pagination limits results', async () => {
      const repo = await factory();
      for (let i = 0; i < 5; i++) {
        await repo.create(fixture.makeEntity());
      }
      const result = await repo.findMany({ page: { limit: 2, offset: 0 } });
      expect(result._unsafeUnwrap().items.length).toBeLessThanOrEqual(2);
    });

    it('count reflects the number of entities', async () => {
      const repo = await factory();
      const before = (await repo.count())._unsafeUnwrap();
      await repo.create(fixture.makeEntity());
      const after = (await repo.count())._unsafeUnwrap();
      expect(after).toBe(before + 1);
    });

    it('hardDelete removes the entity', async () => {
      const repo = await factory();
      const entity = fixture.makeEntity();
      await repo.create(entity);
      await repo.hardDelete(entity.id);
      const found = await repo.findById(entity.id);
      expect(found._unsafeUnwrap()).toBeNull();
    });
  });
}
