/**
 * Conformance suite for PrdTemplateRepository.
 *
 * Any adapter that implements PrdTemplateRepository must pass every test in
 * this suite. Run from the adapter's test file:
 *
 *   import { runPrdTemplateRepositoryConformance } from '@platform/ports-prd-persistence/conformance';
 *   runPrdTemplateRepositoryConformance(() => new MyPrdTemplateRepository(db));
 */

import type { PrdTemplateRepository } from '@platform/core';

import { uuidv7 } from 'uuidv7';
import { beforeEach, describe, expect, it } from 'vitest';

import { makePrdTemplate } from './fixtures.js';

export function runPrdTemplateRepositoryConformance(makeRepo: () => PrdTemplateRepository): void {
  describe('PrdTemplateRepository conformance', () => {
    let repo: PrdTemplateRepository;

    beforeEach(() => {
      repo = makeRepo();
    });

    // ── create / findById ─────────────────────────────────────────────────────

    it('creates a workspace template and retrieves it by ID with all fields intact', async () => {
      const workspaceId = uuidv7();
      const template = makePrdTemplate(workspaceId);

      const createResult = await repo.create(template);
      expect(createResult.isOk()).toBe(true);

      const findResult = await repo.findById(template.id);
      expect(findResult.isOk()).toBe(true);

      const found = findResult._unsafeUnwrap();
      expect(found).not.toBeNull();
      if (found === null) return;
      expect(found.id).toBe(template.id);
      expect(found.workspaceId).toBe(workspaceId);
      expect(found.name).toBe(template.name);
      expect(found.description).toBe(template.description);
      expect(found.category).toBe(template.category);
      expect(found.builtIn).toBe(false);
    });

    // ── findByWorkspaceId ─────────────────────────────────────────────────────

    it('returns only templates belonging to the queried workspace', async () => {
      const workspaceA = uuidv7();
      const workspaceB = uuidv7();

      const templateA1 = makePrdTemplate(workspaceA, { name: 'Template A-1' });
      const templateA2 = makePrdTemplate(workspaceA, { name: 'Template A-2' });
      const templateB1 = makePrdTemplate(workspaceB, { name: 'Template B-1' });

      await repo.create(templateA1);
      await repo.create(templateA2);
      await repo.create(templateB1);

      const result = await repo.findByWorkspaceId(workspaceA);
      expect(result.isOk()).toBe(true);

      const templates = result._unsafeUnwrap();
      expect(templates).toHaveLength(2);

      const ids = templates.map((t) => t.id);
      expect(ids).toContain(templateA1.id);
      expect(ids).toContain(templateA2.id);
      expect(ids).not.toContain(templateB1.id);
    });

    it('returns ok([]) for an unknown workspaceId', async () => {
      const result = await repo.findByWorkspaceId('non-existent-workspace-id');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([]);
    });

    // ── delete ────────────────────────────────────────────────────────────────

    it('deletes a template so that findById returns ok(null) afterwards', async () => {
      const workspaceId = uuidv7();
      const template = makePrdTemplate(workspaceId);

      await repo.create(template);

      const deleteResult = await repo.delete(template.id);
      expect(deleteResult.isOk()).toBe(true);

      const findResult = await repo.findById(template.id);
      expect(findResult.isOk()).toBe(true);
      expect(findResult._unsafeUnwrap()).toBeNull();
    });

    it('returns an error result when deleting a template that does not exist', async () => {
      const result = await repo.delete('non-existent-id');
      expect(result.isErr()).toBe(true);
    });
  });
}
