/**
 * Conformance suite for PrdSectionRepository.
 *
 * Any adapter that implements PrdSectionRepository must pass every test in
 * this suite. Run from the adapter's test file:
 *
 *   import { runPrdSectionRepositoryConformance } from '@platform/ports-prd-persistence/conformance';
 *   runPrdSectionRepositoryConformance(() => new MyPrdSectionRepository(db));
 */

import type { PrdSectionRepository } from '@platform/core';

import { uuidv7 } from 'uuidv7';
import { beforeEach, describe, expect, it } from 'vitest';

import { makePrdSection } from './fixtures.js';

export function runPrdSectionRepositoryConformance(makeRepo: () => PrdSectionRepository): void {
  describe('PrdSectionRepository conformance', () => {
    let repo: PrdSectionRepository;

    beforeEach(() => {
      repo = makeRepo();
    });

    // ── create / findById ─────────────────────────────────────────────────────

    it('creates a section and retrieves it by ID with all fields intact', async () => {
      const prdId = uuidv7();
      const section = makePrdSection(prdId, 'overview');

      const createResult = await repo.create(section);
      expect(createResult.isOk()).toBe(true);

      const findResult = await repo.findById(section.id);
      expect(findResult.isOk()).toBe(true);

      const found = findResult._unsafeUnwrap();
      expect(found).not.toBeNull();
      if (found === null) return;
      expect(found.id).toBe(section.id);
      expect(found.prdId).toBe(prdId);
      expect(found.sectionType).toBe('overview');
      expect(found.status).toBe(section.status);
      expect(found.version).toBe(section.version);
    });

    it('returns ok(null) for an unknown ID', async () => {
      const result = await repo.findById('non-existent-id');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    // ── findByPrdId ───────────────────────────────────────────────────────────

    it('returns only the sections belonging to the queried PRD', async () => {
      const targetPrdId = uuidv7();
      const otherPrdId = uuidv7();

      const sectionA = makePrdSection(targetPrdId, 'overview');
      const sectionB = makePrdSection(targetPrdId, 'goals_and_success_metrics');
      const sectionC = makePrdSection(targetPrdId, 'user_stories');
      const sectionOther = makePrdSection(otherPrdId, 'overview');

      await repo.create(sectionA);
      await repo.create(sectionB);
      await repo.create(sectionC);
      await repo.create(sectionOther);

      const result = await repo.findByPrdId(targetPrdId);
      expect(result.isOk()).toBe(true);

      const sections = result._unsafeUnwrap();
      expect(sections).toHaveLength(3);

      const ids = sections.map((s) => s.id);
      expect(ids).toContain(sectionA.id);
      expect(ids).toContain(sectionB.id);
      expect(ids).toContain(sectionC.id);
      expect(ids).not.toContain(sectionOther.id);
    });

    it('returns ok([]) for an unknown prdId', async () => {
      const result = await repo.findByPrdId('non-existent-prd-id');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([]);
    });

    // ── update: content ───────────────────────────────────────────────────────

    it('updates content and reflects new content in the returned section', async () => {
      const prdId = uuidv7();
      const section = makePrdSection(prdId, 'overview');
      await repo.create(section);

      const newContent = {
        summary: 'Updated summary',
        background: 'Updated background',
        problemStatement: 'Updated problem statement',
        proposedSolution: 'Updated proposed solution',
        keyBenefits: ['updated-benefit'],
      };

      const updateResult = await repo.update(section.id, { content: newContent });
      expect(updateResult.isOk()).toBe(true);

      const updated = updateResult._unsafeUnwrap();
      expect((updated.content as typeof newContent).summary).toBe('Updated summary');
      expect((updated.content as typeof newContent).background).toBe('Updated background');
    });

    // ── update: status transitions ────────────────────────────────────────────

    it('transitions status from draft to in_review and then to approved', async () => {
      const prdId = uuidv7();
      const section = makePrdSection(prdId, 'overview', { status: 'draft' });
      await repo.create(section);

      const toReview = await repo.update(section.id, { status: 'in_review' });
      expect(toReview.isOk()).toBe(true);
      expect(toReview._unsafeUnwrap().status).toBe('in_review');

      const toApproved = await repo.update(section.id, { status: 'approved' });
      expect(toApproved.isOk()).toBe(true);
      expect(toApproved._unsafeUnwrap().status).toBe('approved');
    });

    // ── update: version ───────────────────────────────────────────────────────

    it('updates the version field and reflects the new value', async () => {
      const prdId = uuidv7();
      const section = makePrdSection(prdId, 'overview', { version: 1 });
      await repo.create(section);

      const updateResult = await repo.update(section.id, { version: 2 });
      expect(updateResult.isOk()).toBe(true);
      expect(updateResult._unsafeUnwrap().version).toBe(2);
    });

    // ── ordering / completeness ───────────────────────────────────────────────

    it('findByPrdId returns all created sections for that PRD', async () => {
      const prdId = uuidv7();

      const sections = [
        makePrdSection(prdId, 'overview'),
        makePrdSection(prdId, 'functional_requirements'),
        makePrdSection(prdId, 'risks_and_mitigations'),
      ];

      for (const s of sections) {
        await repo.create(s);
      }

      const result = await repo.findByPrdId(prdId);
      expect(result.isOk()).toBe(true);

      const found = result._unsafeUnwrap();
      expect(found).toHaveLength(3);

      const returnedIds = found.map((s) => s.id).sort();
      const expectedIds = sections.map((s) => s.id).sort();
      expect(returnedIds).toEqual(expectedIds);
    });
  });
}
