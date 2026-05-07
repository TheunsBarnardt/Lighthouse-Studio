/**
 * Conformance suite for PrdArtifactRepository.
 *
 * Any adapter that implements PrdArtifactRepository must pass every test in
 * this suite. Run from the adapter's test file:
 *
 *   import { runPrdArtifactRepositoryConformance } from '@platform/ports-prd-persistence/conformance';
 *   runPrdArtifactRepositoryConformance(() => new MyPrdArtifactRepository(db));
 */

import type { PrdArtifactRepository } from '@platform/core';

import { uuidv7 } from 'uuidv7';
import { beforeEach, describe, expect, it } from 'vitest';

import { makePrdArtifact } from './fixtures.js';

export function runPrdArtifactRepositoryConformance(makeRepo: () => PrdArtifactRepository): void {
  describe('PrdArtifactRepository conformance', () => {
    let repo: PrdArtifactRepository;

    beforeEach(() => {
      repo = makeRepo();
    });

    // ── create / findById ─────────────────────────────────────────────────────

    it('creates a PRD artifact and retrieves it by ID with all fields intact', async () => {
      const artifact = makePrdArtifact();

      const createResult = await repo.create(artifact);
      expect(createResult.isOk()).toBe(true);

      const findResult = await repo.findById(artifact.id);
      expect(findResult.isOk()).toBe(true);

      const found = findResult._unsafeUnwrap();
      expect(found).not.toBeNull();
      if (found === null) return;
      expect(found.id).toBe(artifact.id);
      expect(found.workspaceId).toBe(artifact.workspaceId);
      expect(found.pipelineId).toBe(artifact.pipelineId);
      expect(found.artifactType).toBe(artifact.artifactType);
      expect(found.version).toBe(artifact.version);
      expect(found.status).toBe(artifact.status);
      expect(found.content.intentBriefId).toBe(artifact.content.intentBriefId);
      expect(found.content.templateUsed).toBe(artifact.content.templateUsed);
      expect(found.createdBy).toBe(artifact.createdBy);
      expect(found.updatedBy).toBe(artifact.updatedBy);
    });

    it('returns ok(null) for an unknown ID', async () => {
      const result = await repo.findById('non-existent-id');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    // ── update: content fields ────────────────────────────────────────────────

    it('updates content fields and reflects changes in the returned artifact', async () => {
      const artifact = makePrdArtifact();
      await repo.create(artifact);

      const updatedTemplateUsed = 'saas-template-v2';
      const updateResult = await repo.update(artifact.id, {
        templateUsed: updatedTemplateUsed,
      });

      expect(updateResult.isOk()).toBe(true);
      const updated = updateResult._unsafeUnwrap();
      expect(updated.content.templateUsed).toBe(updatedTemplateUsed);
    });

    // ── update: status ────────────────────────────────────────────────────────

    it('updates status to approved and reflects the change', async () => {
      const artifact = makePrdArtifact({ status: 'draft' });
      await repo.create(artifact);

      const updateResult = await repo.update(artifact.id, { status: 'approved' });
      expect(updateResult.isOk()).toBe(true);

      const updated = updateResult._unsafeUnwrap();
      expect(updated.status).toBe('approved');
    });

    // ── update: updatedAt advances ────────────────────────────────────────────

    it('updatedAt after update is greater than or equal to updatedAt at creation', async () => {
      const before = new Date();
      const artifact = makePrdArtifact({ createdAt: before, updatedAt: before });
      await repo.create(artifact);

      // Small delay so clock can advance in implementations that use wall time.
      await new Promise((resolve) => setTimeout(resolve, 2));

      const updateResult = await repo.update(artifact.id, { status: 'in_review' });
      expect(updateResult.isOk()).toBe(true);

      const updated = updateResult._unsafeUnwrap();
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    // ── update: unknown ID returns an error ───────────────────────────────────

    it('returns an error result when updating an artifact that does not exist', async () => {
      const result = await repo.update('non-existent-id', { status: 'rejected' });
      expect(result.isErr()).toBe(true);
    });

    // ── workspace isolation ───────────────────────────────────────────────────

    it('isolates artifacts by workspace — IDs from different workspaces do not collide', async () => {
      const workspaceA = uuidv7();
      const workspaceB = uuidv7();

      const artifactA = makePrdArtifact({ workspaceId: workspaceA });
      const artifactB = makePrdArtifact({ workspaceId: workspaceB });

      await repo.create(artifactA);
      await repo.create(artifactB);

      const foundA = await repo.findById(artifactA.id);
      const foundB = await repo.findById(artifactB.id);

      const foundAValue = foundA._unsafeUnwrap();
      const foundBValue = foundB._unsafeUnwrap();
      expect(foundAValue).not.toBeNull();
      expect(foundBValue).not.toBeNull();
      if (!foundAValue || !foundBValue) return;
      expect(foundAValue.workspaceId).toBe(workspaceA);
      expect(foundBValue.workspaceId).toBe(workspaceB);

      // IDs are unique — looking up A's ID must not return B's artifact.
      expect(foundAValue.id).not.toBe(artifactB.id);
    });
  });
}
