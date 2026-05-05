/* eslint-disable @typescript-eslint/require-await */
import type {
  AssetCategory,
  AssetTopLevel,
  ConsumedAssetSnapshot,
  ContextualAsset,
  ReplaceAssetInput,
  StageAssetContext,
  StalenessCheck,
  UploadAssetInput,
  WorkspaceAsset,
  WorkspaceAssetPort,
  WorkspaceAssetQuota,
} from '@platform/ports-workspace-assets';

import {
  AssetNotFoundError,
  AssetQuotaExceededError,
  AssetStorageError,
} from '@platform/ports-workspace-assets';
import { ok, err } from 'neverthrow';
import { Readable } from 'node:stream';
import { uuidv7 } from 'uuidv7';
import { describe, it, expect } from 'vitest';

import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  makeUserContext,
} from '../testing/index.js';
import { WorkspaceAssetService } from './workspace-asset.service.js';

// ── In-memory WorkspaceAssetPort ──────────────────────────────────────────────

interface InMemoryWorkspaceAssetPort extends WorkspaceAssetPort {
  store: Map<string, WorkspaceAsset>;
  quotas: Map<string, WorkspaceAssetQuota>;
  generationRefs: Map<string, ConsumedAssetSnapshot>;
  forceQuotaError?: boolean;
  forceStorageError?: boolean;
}

function createInMemoryAssetPort(
  opts: { forceQuotaError?: boolean; forceStorageError?: boolean } = {},
): InMemoryWorkspaceAssetPort {
  const store = new Map<string, WorkspaceAsset>();
  const quotas = new Map<string, WorkspaceAssetQuota>();
  const generationRefs = new Map<string, ConsumedAssetSnapshot>();

  const defaultQuota = (workspaceId: string): WorkspaceAssetQuota => ({
    workspaceId,
    usedBytes: 0,
    allowanceBytes: 1_073_741_824,
  });

  // Build the WorkspaceAssetPort methods without type annotation to avoid
  // exactOptionalPropertyTypes conflicts, then augment with test helpers.
  const portMethods: WorkspaceAssetPort = {
    async upload(input: UploadAssetInput) {
      if (opts.forceStorageError) return err(new AssetStorageError('forced error'));
      if (opts.forceQuotaError) {
        return err(new AssetQuotaExceededError(input.workspaceId, 999, 1));
      }
      const quota = quotas.get(input.workspaceId) ?? defaultQuota(input.workspaceId);
      if (quota.usedBytes + input.sizeBytes > quota.allowanceBytes) {
        return err(
          new AssetQuotaExceededError(
            input.workspaceId,
            quota.usedBytes + input.sizeBytes,
            quota.allowanceBytes,
          ),
        );
      }
      const now = new Date();
      const asset: WorkspaceAsset = {
        id: uuidv7(),
        version: 1,
        workspaceId: input.workspaceId,
        topLevel: input.topLevel,
        category: input.category,
        role: input.role ?? null,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: `/workspaces/${input.workspaceId}/assets/${input.topLevel}/${input.category}/${input.filename}`,
        parsedTextKey: null,
        validationStatus: 'valid',
        validationReason: null,
        uploadedBy: input.workspaceId,
        createdAt: now,
        updatedAt: now,
      };
      store.set(asset.id, asset);
      quotas.set(input.workspaceId, { ...quota, usedBytes: quota.usedBytes + input.sizeBytes });
      return ok(asset);
    },

    async replace(input: ReplaceAssetInput) {
      if (opts.forceStorageError) return err(new AssetStorageError('forced error'));
      const existing = store.get(input.assetId);
      if (!existing || existing.workspaceId !== input.workspaceId) {
        return err(new AssetNotFoundError(input.assetId));
      }
      const updated: WorkspaceAsset = {
        ...existing,
        version: existing.version + 1,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        updatedAt: new Date(),
      };
      store.set(input.assetId, updated);
      return ok(updated);
    },

    async delete(workspaceId: string, assetId: string) {
      if (opts.forceStorageError) return err(new AssetStorageError('forced error'));
      const existing = store.get(assetId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return err(new AssetNotFoundError(assetId));
      }
      store.delete(assetId);
      return ok(undefined);
    },

    async listByCategory(workspaceId: string, _topLevel: AssetTopLevel, category: AssetCategory) {
      const results = [...store.values()].filter(
        (a) => a.workspaceId === workspaceId && a.category === category,
      );
      return ok(results);
    },

    async listByContext(workspaceId: string, context: StageAssetContext) {
      const categories = new Set<AssetCategory>([
        ...(context.brand ?? []),
        ...(context.documents ?? []),
      ]);
      const results: ContextualAsset[] = [...store.values()]
        .filter((a) => a.workspaceId === workspaceId && categories.has(a.category))
        .map((a) => ({ ...a, contextCategory: a.category, parsedText: null }));
      return ok(results);
    },

    async getQuota(workspaceId: string) {
      return ok(quotas.get(workspaceId) ?? defaultQuota(workspaceId));
    },

    async findById(workspaceId: string, assetId: string) {
      const asset = store.get(assetId);
      return ok(asset?.workspaceId === workspaceId ? asset : null);
    },

    async recordConsumedAssets(
      _workspaceId: string,
      generationId: string,
      snapshot: ConsumedAssetSnapshot,
    ) {
      generationRefs.set(generationId, snapshot);
      return ok(undefined);
    },

    async checkStaleness(_workspaceId: string, snapshot: ConsumedAssetSnapshot) {
      const staleAssets: StalenessCheck['staleAssets'] = [];
      for (const [assetId, entry] of Object.entries(snapshot)) {
        const current = store.get(assetId);
        const currentVersion = current?.version ?? 0;
        if (currentVersion !== entry.version) {
          staleAssets.push({
            assetId,
            category: entry.category,
            filename: entry.filename,
            previousVersion: entry.version,
            currentVersion,
          });
        }
      }
      return ok({ isStale: staleAssets.length > 0, staleAssets });
    },
  };

  const port: InMemoryWorkspaceAssetPort = Object.assign(portMethods, {
    store,
    quotas,
    generationRefs,
  });
  if (opts.forceQuotaError !== undefined) port.forceQuotaError = opts.forceQuotaError;
  if (opts.forceStorageError !== undefined) port.forceStorageError = opts.forceStorageError;
  return port;
}

// ── Test helpers ──────────────────────────────────────────────────────────────

const WS_ID = 'ws-test-1';
const USER_ID = 'user-test-1';

function makeCtx() {
  return makeUserContext({ userId: USER_ID, workspaceId: WS_ID });
}

function makeAdapters(
  opts: {
    denyActions?: string[];
    denyAll?: boolean;
    forceQuotaError?: boolean;
    forceStorageError?: boolean;
  } = {},
) {
  const authzOpts: Parameters<typeof createInMemoryAuthz>[0] = {};
  if (opts.denyAll !== undefined) authzOpts['deny'] = opts.denyAll;
  if (opts.denyActions !== undefined) authzOpts['denyActions'] = opts.denyActions;

  const assetOpts: Parameters<typeof createInMemoryAssetPort>[0] = {};
  if (opts.forceQuotaError !== undefined) assetOpts['forceQuotaError'] = opts.forceQuotaError;
  if (opts.forceStorageError !== undefined) assetOpts['forceStorageError'] = opts.forceStorageError;

  return {
    authz: createInMemoryAuthz(authzOpts),
    assets: createInMemoryAssetPort(assetOpts),
    audit: createInMemoryAudit(),
    logger: createInMemoryLogger(),
  };
}

function makeService(opts: Parameters<typeof makeAdapters>[0] = {}) {
  const adapters = makeAdapters(opts);
  const service = new WorkspaceAssetService(
    adapters.authz,
    adapters.assets,
    adapters.audit,
    adapters.logger,
  );
  return { service, adapters };
}

function makeStream(content = 'test content'): Readable {
  return Readable.from([Buffer.from(content)]);
}

// ── upload ────────────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.upload', () => {
  it('uploads a valid asset and returns metadata', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const result = await service.upload(ctx, {
      topLevel: 'documents',
      category: 'voice',
      filename: 'brand-voice.md',
      mimeType: 'text/markdown',
      sizeBytes: 200,
      data: makeStream(),
    });

    expect(result.isOk()).toBe(true);
    const asset = result._unsafeUnwrap();
    expect(asset.category).toBe('voice');
    expect(asset.topLevel).toBe('documents');
    expect(asset.version).toBe(1);
  });

  it('persists the asset in the store', async () => {
    const { service, adapters } = makeService();
    const result = await service.upload(makeCtx(), {
      topLevel: 'brand',
      category: 'logos',
      filename: 'logo.svg',
      mimeType: 'image/svg+xml',
      sizeBytes: 512,
      data: makeStream('<svg/>'),
    });
    expect(result.isOk()).toBe(true);
    expect(adapters.assets.store.size).toBe(1);
  });

  it('emits workspace_asset.uploaded audit event on success', async () => {
    const { service, adapters } = makeService();
    await service.upload(makeCtx(), {
      topLevel: 'documents',
      category: 'strategy',
      filename: 'strategy.md',
      mimeType: 'text/markdown',
      sizeBytes: 100,
      data: makeStream(),
    });
    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace_asset.uploaded', outcome: 'success' }),
    );
  });

  it('returns ForbiddenError when upload action is denied', async () => {
    const { service } = makeService({ denyActions: ['workspace.assets.upload'] });
    const result = await service.upload(makeCtx(), {
      topLevel: 'documents',
      category: 'voice',
      filename: 'voice.md',
      mimeType: 'text/markdown',
      sizeBytes: 10,
      data: makeStream(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns ConflictError when quota is exceeded', async () => {
    const { service } = makeService({ forceQuotaError: true });
    const result = await service.upload(makeCtx(), {
      topLevel: 'documents',
      category: 'voice',
      filename: 'big.txt',
      mimeType: 'text/plain',
      sizeBytes: 999_999_999,
      data: makeStream(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('returns WorkspaceContextRequiredError when workspaceId is absent', async () => {
    const { service } = makeService();
    const ctx = makeUserContext({ userId: USER_ID }); // no workspaceId
    const result = await service.upload(ctx, {
      topLevel: 'documents',
      category: 'voice',
      filename: 'x.md',
      mimeType: 'text/markdown',
      sizeBytes: 10,
      data: makeStream(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('WORKSPACE_CONTEXT_REQUIRED');
  });

  it('returns ValidationError for invalid category', async () => {
    const { service } = makeService();
    const result = await service.upload(makeCtx(), {
      topLevel: 'documents',
      category: 'invalid-cat' as AssetCategory,
      filename: 'x.md',
      mimeType: 'text/markdown',
      sizeBytes: 10,
      data: makeStream(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });
});

// ── replace ───────────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.replace', () => {
  it('replaces an existing asset and bumps version', async () => {
    const { service } = makeService();
    const ctx = makeCtx();
    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'documents',
        category: 'voice',
        filename: 'voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 100,
        data: makeStream('v1'),
      })
    )._unsafeUnwrap();

    const replaced = await service.replace(ctx, {
      assetId: uploaded.id,
      filename: 'voice.md',
      mimeType: 'text/markdown',
      sizeBytes: 150,
      data: makeStream('v2'),
    });

    expect(replaced.isOk()).toBe(true);
    expect(replaced._unsafeUnwrap().version).toBe(2);
  });

  it('emits workspace_asset.replaced audit event', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();
    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'documents',
        category: 'voice',
        filename: 'v.md',
        mimeType: 'text/markdown',
        sizeBytes: 50,
        data: makeStream(),
      })
    )._unsafeUnwrap();

    await service.replace(ctx, {
      assetId: uploaded.id,
      filename: 'v.md',
      mimeType: 'text/markdown',
      sizeBytes: 60,
      data: makeStream(),
    });

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace_asset.replaced', outcome: 'success' }),
    );
  });

  it('returns NotFoundError for unknown assetId', async () => {
    const { service } = makeService();
    const result = await service.replace(makeCtx(), {
      assetId: 'ghost-id',
      filename: 'x.md',
      mimeType: 'text/markdown',
      sizeBytes: 10,
      data: makeStream(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns ForbiddenError when upload action is denied', async () => {
    const { service } = makeService({ denyActions: ['workspace.assets.upload'] });
    const result = await service.replace(makeCtx(), {
      assetId: 'any-id',
      filename: 'x.md',
      mimeType: 'text/markdown',
      sizeBytes: 10,
      data: makeStream(),
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.delete', () => {
  it('deletes an existing asset', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();
    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'documents',
        category: 'compliance',
        filename: 'gdpr.md',
        mimeType: 'text/markdown',
        sizeBytes: 300,
        data: makeStream(),
      })
    )._unsafeUnwrap();

    const result = await service.delete(ctx, uploaded.id);
    expect(result.isOk()).toBe(true);
    expect(adapters.assets.store.has(uploaded.id)).toBe(false);
  });

  it('emits workspace_asset.deleted audit event', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();
    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'brand',
        category: 'logos',
        filename: 'logo.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 1024,
        data: makeStream(),
      })
    )._unsafeUnwrap();

    await service.delete(ctx, uploaded.id);

    expect(adapters.audit.events).toContainEqual(
      expect.objectContaining({ eventType: 'workspace_asset.deleted', outcome: 'success' }),
    );
  });

  it('returns NotFoundError for unknown assetId', async () => {
    const { service } = makeService();
    const result = await service.delete(makeCtx(), 'ghost-id');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('returns ForbiddenError when delete action is denied', async () => {
    const { service } = makeService({ denyActions: ['workspace.assets.delete'] });
    const result = await service.delete(makeCtx(), 'any-id');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── listByCategory ────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.listByCategory', () => {
  it('returns assets for the given category', async () => {
    const { service } = makeService();
    const ctx = makeCtx();
    await service.upload(ctx, {
      topLevel: 'brand',
      category: 'colors',
      filename: 'palette.json',
      mimeType: 'application/json',
      sizeBytes: 200,
      data: makeStream('{}'),
    });

    const result = await service.listByCategory(ctx, { topLevel: 'brand', category: 'colors' });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().length).toBeGreaterThanOrEqual(1);
  });

  it('returns ForbiddenError when read action is denied', async () => {
    const { service } = makeService({ denyActions: ['workspace.assets.read'] });
    const result = await service.listByCategory(makeCtx(), {
      topLevel: 'brand',
      category: 'logos',
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── listByContext ─────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.listByContext', () => {
  it('returns only assets in the declared context categories', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    await service.upload(ctx, {
      topLevel: 'documents',
      category: 'voice',
      filename: 'voice.md',
      mimeType: 'text/markdown',
      sizeBytes: 100,
      data: makeStream('brand voice'),
    });
    await service.upload(ctx, {
      topLevel: 'documents',
      category: 'compliance',
      filename: 'gdpr.md',
      mimeType: 'text/markdown',
      sizeBytes: 100,
      data: makeStream('GDPR'),
    });

    // stage2_prd reads voice, strategy, reference — NOT compliance
    const context: StageAssetContext = { documents: ['voice', 'strategy', 'reference'] };
    const result = await service.listByContext(ctx, context);

    expect(result.isOk()).toBe(true);
    const assets = result._unsafeUnwrap();
    expect(assets.some((a) => a.category === 'voice')).toBe(true);
    expect(assets.some((a) => a.category === 'compliance')).toBe(false);
  });
});

// ── getQuota ──────────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.getQuota', () => {
  it('returns quota reflecting uploaded bytes', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const before = (await service.getQuota(ctx))._unsafeUnwrap();
    await service.upload(ctx, {
      topLevel: 'documents',
      category: 'specs',
      filename: 'api.txt',
      mimeType: 'text/plain',
      sizeBytes: 512,
      data: makeStream(),
    });
    const after = (await service.getQuota(ctx))._unsafeUnwrap();

    expect(after.usedBytes).toBe(before.usedBytes + 512);
  });

  it('returns ForbiddenError when read action is denied', async () => {
    const { service } = makeService({ denyActions: ['workspace.assets.read'] });
    const result = await service.getQuota(makeCtx());
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});

// ── getById ───────────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.getById', () => {
  it('returns an existing asset by id', async () => {
    const { service } = makeService();
    const ctx = makeCtx();
    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'brand',
        category: 'fonts',
        filename: 'inter.woff2',
        mimeType: 'font/woff2',
        sizeBytes: 48_000,
        data: makeStream(),
      })
    )._unsafeUnwrap();

    const result = await service.getById(ctx, uploaded.id);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().id).toBe(uploaded.id);
  });

  it('returns NotFoundError for unknown id', async () => {
    const { service } = makeService();
    const result = await service.getById(makeCtx(), 'not-real');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });
});

// ── recordConsumedAssets ──────────────────────────────────────────────────────

describe('WorkspaceAssetService.recordConsumedAssets', () => {
  it('stores the snapshot keyed by generationId', async () => {
    const { service, adapters } = makeService();
    const ctx = makeCtx();

    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'documents',
        category: 'voice',
        filename: 'voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 100,
        data: makeStream('voice content'),
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

    const result = await service.recordConsumedAssets(ctx, 'gen-001', snapshot);
    expect(result.isOk()).toBe(true);
    expect(adapters.assets.generationRefs.get('gen-001')).toEqual(snapshot);
  });

  it('returns ForbiddenError when read action is denied', async () => {
    const { service } = makeService({ denyActions: ['workspace.assets.read'] });
    const result = await service.recordConsumedAssets(makeCtx(), 'gen-x', {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns ValidationError when generationId is empty', async () => {
    const { service } = makeService();
    const result = await service.recordConsumedAssets(makeCtx(), '', {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });
});

// ── checkStaleness ────────────────────────────────────────────────────────────

describe('WorkspaceAssetService.checkStaleness', () => {
  it('returns isStale: false when all asset versions match', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'documents',
        category: 'voice',
        filename: 'voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 100,
        data: makeStream(),
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

    const result = await service.checkStaleness(ctx, snapshot);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().isStale).toBe(false);
    expect(result._unsafeUnwrap().staleAssets).toHaveLength(0);
  });

  it('returns isStale: true with stale entries after a replace', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'documents',
        category: 'voice',
        filename: 'voice.md',
        mimeType: 'text/markdown',
        sizeBytes: 100,
        data: makeStream('v1'),
      })
    )._unsafeUnwrap();

    // Snapshot captured at generation time (version 1)
    const snapshot: ConsumedAssetSnapshot = {
      [uploaded.id]: {
        version: 1,
        category: 'voice',
        filename: 'voice.md',
        topLevel: 'documents',
      },
    };

    // Later, the document is replaced (bumps to version 2)
    await service.replace(ctx, {
      assetId: uploaded.id,
      filename: 'voice.md',
      mimeType: 'text/markdown',
      sizeBytes: 120,
      data: makeStream('v2'),
    });

    const result = await service.checkStaleness(ctx, snapshot);
    expect(result.isOk()).toBe(true);
    const check = result._unsafeUnwrap();
    expect(check.isStale).toBe(true);
    expect(check.staleAssets).toHaveLength(1);
    expect(check.staleAssets[0]!.assetId).toBe(uploaded.id);
    expect(check.staleAssets[0]!.previousVersion).toBe(1);
    expect(check.staleAssets[0]!.currentVersion).toBe(2);
  });

  it('flags a deleted asset as stale', async () => {
    const { service } = makeService();
    const ctx = makeCtx();

    const uploaded = (
      await service.upload(ctx, {
        topLevel: 'documents',
        category: 'compliance',
        filename: 'gdpr.md',
        mimeType: 'text/markdown',
        sizeBytes: 50,
        data: makeStream(),
      })
    )._unsafeUnwrap();

    const snapshot: ConsumedAssetSnapshot = {
      [uploaded.id]: {
        version: 1,
        category: 'compliance',
        filename: 'gdpr.md',
        topLevel: 'documents',
      },
    };

    await service.delete(ctx, uploaded.id);

    const result = await service.checkStaleness(ctx, snapshot);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().isStale).toBe(true);
  });

  it('returns ForbiddenError when read action is denied', async () => {
    const { service } = makeService({ denyActions: ['workspace.assets.read'] });
    const result = await service.checkStaleness(makeCtx(), {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });
});
