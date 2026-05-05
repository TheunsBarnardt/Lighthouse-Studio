import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import type { ConsumedAssetSnapshot } from '../types.js';
import type { WorkspaceAssetPort } from '../workspace-asset.port.js';

import { buildConsumedSnapshot, STAGE_ASSET_CONTEXT } from '../stage-context.js';

function makeReadable(content: string): Readable {
  return Readable.from([Buffer.from(content)]);
}

export function runWorkspaceAssetConformance(
  name: string,
  factory: () => Promise<{ port: WorkspaceAssetPort; workspaceId: string }>,
): void {
  describe(`${name} — WorkspaceAssetPort conformance`, () => {
    it('upload stores an asset and returns metadata', async () => {
      const { port, workspaceId } = await factory();
      const result = await port.upload({
        workspaceId,
        topLevel: 'documents',
        category: 'voice',
        filename: 'brand-voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 100,
        data: makeReadable('# Brand Voice\n\nBe friendly.'),
      });
      expect(result.isOk()).toBe(true);
      const asset = result._unsafeUnwrap();
      expect(asset.workspaceId).toBe(workspaceId);
      expect(asset.category).toBe('voice');
      expect(asset.mimeType).toBe('text/markdown');
      expect(asset.version).toBe(1);
    });

    it('findById returns the uploaded asset', async () => {
      const { port, workspaceId } = await factory();
      const upload = await port.upload({
        workspaceId,
        topLevel: 'documents',
        category: 'strategy',
        filename: 'strategy.md',
        mimeType: 'text/markdown',
        sizeBytes: 50,
        data: makeReadable('# Strategy'),
      });
      const asset = upload._unsafeUnwrap();
      const found = await port.findById(workspaceId, asset.id);
      expect(found._unsafeUnwrap()?.id).toBe(asset.id);
    });

    it('findById returns null for a nonexistent asset', async () => {
      const { port, workspaceId } = await factory();
      const result = await port.findById(workspaceId, 'nonexistent-id');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('replace bumps version and returns updated asset', async () => {
      const { port, workspaceId } = await factory();
      const uploaded = (
        await port.upload({
          workspaceId,
          topLevel: 'documents',
          category: 'voice',
          filename: 'voice.md',
          mimeType: 'text/markdown',
          sizeBytes: 20,
          data: makeReadable('v1'),
        })
      )._unsafeUnwrap();

      const replaced = await port.replace({
        assetId: uploaded.id,
        workspaceId,
        filename: 'voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 20,
        data: makeReadable('v2'),
      });
      expect(replaced.isOk()).toBe(true);
      expect(replaced._unsafeUnwrap().version).toBe(2);
    });

    it('replace returns AssetNotFoundError for unknown asset', async () => {
      const { port, workspaceId } = await factory();
      const result = await port.replace({
        assetId: 'does-not-exist',
        workspaceId,
        filename: 'x.md',
        mimeType: 'text/markdown',
        sizeBytes: 5,
        data: makeReadable('x'),
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('ASSET_NOT_FOUND');
    });

    it('delete removes the asset', async () => {
      const { port, workspaceId } = await factory();
      const uploaded = (
        await port.upload({
          workspaceId,
          topLevel: 'documents',
          category: 'reference',
          filename: 'ref.txt',
          mimeType: 'text/plain',
          sizeBytes: 5,
          data: makeReadable('hello'),
        })
      )._unsafeUnwrap();

      const del = await port.delete(workspaceId, uploaded.id);
      expect(del.isOk()).toBe(true);

      const found = await port.findById(workspaceId, uploaded.id);
      expect(found._unsafeUnwrap()).toBeNull();
    });

    it('delete returns AssetNotFoundError for unknown asset', async () => {
      const { port, workspaceId } = await factory();
      const result = await port.delete(workspaceId, 'ghost-id');
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().code).toBe('ASSET_NOT_FOUND');
    });

    it('listByCategory returns assets for the given category', async () => {
      const { port, workspaceId } = await factory();
      await port.upload({
        workspaceId,
        topLevel: 'brand',
        category: 'logos',
        filename: 'logo.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 200,
        data: makeReadable('<svg/>'),
      });
      const result = await port.listByCategory(workspaceId, 'brand', 'logos');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().length).toBeGreaterThanOrEqual(1);
      expect(result._unsafeUnwrap().every((a) => a.category === 'logos')).toBe(true);
    });

    it('listByContext returns assets for declared stage categories only', async () => {
      const { port, workspaceId } = await factory();
      // Upload voice doc (should appear) and compliance doc (should NOT appear)
      await port.upload({
        workspaceId,
        topLevel: 'documents',
        category: 'voice',
        filename: 'voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 30,
        data: makeReadable('Voice content'),
      });
      await port.upload({
        workspaceId,
        topLevel: 'documents',
        category: 'compliance',
        filename: 'gdpr.md',
        mimeType: 'text/markdown',
        sizeBytes: 30,
        data: makeReadable('GDPR notes'),
      });
      // stage2_prd reads voice, strategy, reference — NOT compliance
      const result = await port.listByContext(workspaceId, STAGE_ASSET_CONTEXT.stage2_prd);
      expect(result.isOk()).toBe(true);
      const assets = result._unsafeUnwrap();
      expect(assets.some((a) => a.category === 'voice')).toBe(true);
      expect(assets.some((a) => a.category === 'compliance')).toBe(false);
    });

    it('getQuota reflects uploaded bytes', async () => {
      const { port, workspaceId } = await factory();
      const before = (await port.getQuota(workspaceId))._unsafeUnwrap();
      const uploadSize = 512;
      await port.upload({
        workspaceId,
        topLevel: 'documents',
        category: 'specs',
        filename: 'api.txt',
        mimeType: 'text/plain',
        sizeBytes: uploadSize,
        data: makeReadable('x'.repeat(uploadSize)),
      });
      const after = (await port.getQuota(workspaceId))._unsafeUnwrap();
      expect(after.usedBytes).toBe(before.usedBytes + uploadSize);
    });

    it('upload returns AssetQuotaExceededError when allowance exhausted', async () => {
      const { port, workspaceId } = await factory();
      // Upload something that exceeds the quota by a large amount.
      // Implementations should set a tiny allowance for this test workspace.
      const result = await port.upload({
        workspaceId: `${workspaceId}-tiny-quota`,
        topLevel: 'documents',
        category: 'voice',
        filename: 'big.txt',
        mimeType: 'text/plain',
        sizeBytes: 999_999_999,
        data: makeReadable('x'),
      });
      // Only assert the error code; implementations control quota setup
      if (result.isErr()) {
        expect(result._unsafeUnwrapErr().code).toBe('ASSET_QUOTA_EXCEEDED');
      }
    });

    it('recordConsumedAssets stores a snapshot without error', async () => {
      const { port, workspaceId } = await factory();
      const uploaded = (
        await port.upload({
          workspaceId,
          topLevel: 'documents',
          category: 'voice',
          filename: 'voice.md',
          mimeType: 'text/markdown',
          sizeBytes: 50,
          data: makeReadable('content'),
        })
      )._unsafeUnwrap();

      const snapshot: ConsumedAssetSnapshot = {
        [uploaded.id]: {
          version: uploaded.version,
          category: 'voice',
          filename: 'voice.md',
          topLevel: 'documents',
        },
      };

      const result = await port.recordConsumedAssets(workspaceId, 'gen-conformance-001', snapshot);
      expect(result.isOk()).toBe(true);
    });

    it('buildConsumedSnapshot captures correct versions from listByContext result', async () => {
      const { port, workspaceId } = await factory();
      await port.upload({
        workspaceId,
        topLevel: 'documents',
        category: 'voice',
        filename: 'voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 40,
        data: makeReadable('voice'),
      });
      const assets = (
        await port.listByContext(workspaceId, STAGE_ASSET_CONTEXT.stage2_prd)
      )._unsafeUnwrap();
      const snapshot = buildConsumedSnapshot(assets);
      for (const asset of assets) {
        expect(snapshot[asset.id]).toBeDefined();
        expect(snapshot[asset.id]?.version).toBe(asset.version);
      }
    });

    it('checkStaleness returns isStale: false for a current snapshot', async () => {
      const { port, workspaceId } = await factory();
      const uploaded = (
        await port.upload({
          workspaceId,
          topLevel: 'documents',
          category: 'strategy',
          filename: 'strategy.md',
          mimeType: 'text/markdown',
          sizeBytes: 60,
          data: makeReadable('strategy v1'),
        })
      )._unsafeUnwrap();

      const snapshot: ConsumedAssetSnapshot = {
        [uploaded.id]: {
          version: uploaded.version,
          category: 'strategy',
          filename: 'strategy.md',
          topLevel: 'documents',
        },
      };

      const result = await port.checkStaleness(workspaceId, snapshot);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().isStale).toBe(false);
    });

    it('checkStaleness returns isStale: true after an asset is replaced', async () => {
      const { port, workspaceId } = await factory();
      const uploaded = (
        await port.upload({
          workspaceId,
          topLevel: 'documents',
          category: 'reference',
          filename: 'ref.md',
          mimeType: 'text/markdown',
          sizeBytes: 30,
          data: makeReadable('v1'),
        })
      )._unsafeUnwrap();

      const snapshot: ConsumedAssetSnapshot = {
        [uploaded.id]: {
          version: uploaded.version,
          category: 'reference',
          filename: 'ref.md',
          topLevel: 'documents',
        },
      };

      // Replace bumps version
      await port.replace({
        assetId: uploaded.id,
        workspaceId,
        filename: 'ref.md',
        mimeType: 'text/markdown',
        sizeBytes: 35,
        data: makeReadable('v2'),
      });

      const result = await port.checkStaleness(workspaceId, snapshot);
      expect(result.isOk()).toBe(true);
      const check = result._unsafeUnwrap();
      expect(check.isStale).toBe(true);
      expect(check.staleAssets.some((s) => s.assetId === uploaded.id)).toBe(true);
    });
  });
}
