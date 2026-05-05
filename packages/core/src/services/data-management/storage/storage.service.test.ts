import { describe, it, expect, beforeEach } from 'vitest';

import {
  createInMemoryAudit,
  createInMemoryAuthz,
  createInMemoryLogger,
  createInMemoryObjectStorage,
  createInMemoryRepo,
  makeUserContext,
} from '../../../testing/index.js';
import { STORAGE_AUDIT_EVENTS } from './audit-events.js';
import { StorageService } from './storage.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeService(opts?: { denyAll?: boolean }) {
  const authz = createInMemoryAuthz(opts?.denyAll ? { deny: true } : {});
  const storage = createInMemoryObjectStorage();
  const buckets = createInMemoryRepo();
  const fileRecords = createInMemoryRepo();
  const fileAcls = createInMemoryRepo();
  const signedUrls = createInMemoryRepo();
  const quotas = createInMemoryRepo();
  const audit = createInMemoryAudit();
  const logger = createInMemoryLogger();

  const svc = new StorageService(
    authz,
    storage,
    buckets as never,
    fileRecords as never,
    fileAcls as never,
    signedUrls as never,
    quotas as never,
    audit,
    logger,
  );

  return { svc, authz, storage, buckets, fileRecords, fileAcls, signedUrls, quotas, audit };
}

const WS = 'ws-test-1';

function ctx() {
  return makeUserContext({ workspaceId: WS, userId: 'user-1' });
}

// ── Bucket tests ──────────────────────────────────────────────────────────────

describe('StorageService — buckets', () => {
  it('creates a bucket and emits an audit event', async () => {
    const { svc, audit } = makeService();

    const result = await svc.createBucket(ctx(), {
      name: 'My Bucket',
      slug: 'my-bucket',
    });

    expect(result.isOk()).toBe(true);
    const bucket = result._unsafeUnwrap();
    expect(bucket.slug).toBe('my-bucket');
    expect(bucket.workspaceId).toBe(WS);

    const events = audit.events.filter((e) => e.eventType === STORAGE_AUDIT_EVENTS.BUCKET_CREATED);
    expect(events).toHaveLength(1);
    expect(events[0]!.resource.id).toBe(bucket.id);
  });

  it('rejects duplicate bucket slug in same workspace', async () => {
    const { svc } = makeService();

    await svc.createBucket(ctx(), { name: 'First', slug: 'my-slug' });
    const second = await svc.createBucket(ctx(), { name: 'Second', slug: 'my-slug' });

    expect(second.isErr()).toBe(true);
    expect(second._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('returns FORBIDDEN when authz denies bucket.write', async () => {
    const { svc } = makeService({ denyAll: true });

    const result = await svc.createBucket(ctx(), { name: 'x', slug: 'x' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('returns WORKSPACE_CONTEXT_REQUIRED when no workspaceId', async () => {
    const { svc } = makeService();
    const noWs = makeUserContext({ userId: 'u1' });

    const result = await svc.createBucket(noWs, { name: 'x', slug: 'x' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('WORKSPACE_CONTEXT_REQUIRED');
  });

  it('validates slug format', async () => {
    const { svc } = makeService();

    const result = await svc.createBucket(ctx(), {
      name: 'Test',
      slug: 'INVALID SLUG!',
    });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('lists buckets scoped to workspace', async () => {
    const { svc } = makeService();

    await svc.createBucket(ctx(), { name: 'A', slug: 'a' });
    await svc.createBucket(ctx(), { name: 'B', slug: 'b' });

    const result = await svc.listBuckets(ctx());
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toHaveLength(2);
  });

  it('updates a bucket', async () => {
    const { svc } = makeService();

    const created = (await svc.createBucket(ctx(), { name: 'Old', slug: 'old' }))._unsafeUnwrap();
    const updated = await svc.updateBucket(ctx(), created.id, { name: 'New' });

    expect(updated.isOk()).toBe(true);
    expect(updated._unsafeUnwrap().name).toBe('New');
  });

  it('returns NOT_FOUND when updating non-existent bucket', async () => {
    const { svc } = makeService();

    const result = await svc.updateBucket(ctx(), 'does-not-exist', { name: 'x' });

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });
});

// ── File upload tests ─────────────────────────────────────────────────────────

describe('StorageService — file upload', () => {
  let svc: ReturnType<typeof makeService>['svc'];
  let bucketId: string;

  beforeEach(async () => {
    const setup = makeService();
    svc = setup.svc;
    const bucket = (
      await svc.createBucket(ctx(), { name: 'Test Bucket', slug: 'test-bucket' })
    )._unsafeUnwrap();
    bucketId = bucket.id;
  });

  it('uploads a file and creates a file record', async () => {
    const data = Buffer.from('hello world');
    const result = await svc.uploadFile(
      ctx(),
      {
        bucketId,
        filename: 'hello.txt',
        contentType: 'text/plain',
        sizeBytes: data.length,
      },
      data,
    );

    expect(result.isOk()).toBe(true);
    const file = result._unsafeUnwrap();
    expect(file.filename).toBe('hello.txt');
    expect(file.bucketId).toBe(bucketId);
    expect(file.workspaceId).toBe(WS);
    expect(file.status).toBe('available');
  });

  it('rejects upload when bucket not in workspace', async () => {
    const result = await svc.uploadFile(
      ctx(),
      {
        bucketId: '00000000-0000-0000-0000-000000000001', // valid UUID, not in this workspace
        filename: 'file.txt',
        sizeBytes: 5,
      },
      Buffer.from('hello'),
    );

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('emits a storage audit event on upload', async () => {
    const { svc: service, audit } = makeService();
    const b = (await service.createBucket(ctx(), { name: 'B', slug: 'b' }))._unsafeUnwrap();

    await service.uploadFile(
      ctx(),
      { bucketId: b.id, filename: 'f.txt', sizeBytes: 1 },
      Buffer.from('x'),
    );

    const ev = audit.events.find((e) => e.eventType === STORAGE_AUDIT_EVENTS.FILE_UPLOADED);
    expect(ev).toBeDefined();
    expect(ev!.outcome).toBe('success');
  });

  it('respects quota: rejects upload exceeding quota', async () => {
    const { svc: service, quotas } = makeService();
    const b = (await service.createBucket(ctx(), { name: 'B', slug: 'b' }))._unsafeUnwrap();

    // Manually set quota to 10 bytes
    const quotaRecord = [...quotas.store.values()][0];
    if (quotaRecord) {
      quotas.store.set(quotaRecord.id, { ...quotaRecord, quotaBytes: 10 } as never);
    }

    const result = await service.uploadFile(
      ctx(),
      { bucketId: b.id, filename: 'big.bin', sizeBytes: 100 },
      Buffer.alloc(100),
    );

    expect(result.isErr()).toBe(true);
  });
});

// ── File operations ───────────────────────────────────────────────────────────

describe('StorageService — file operations', () => {
  let svc: ReturnType<typeof makeService>['svc'];
  let bucketId: string;
  let fileId: string;

  beforeEach(async () => {
    const setup = makeService();
    svc = setup.svc;
    const bucket = (await svc.createBucket(ctx(), { name: 'Test', slug: 'test' }))._unsafeUnwrap();
    bucketId = bucket.id;

    const file = (
      await svc.uploadFile(
        ctx(),
        { bucketId, filename: 'doc.txt', sizeBytes: 5 },
        Buffer.from('hello'),
      )
    )._unsafeUnwrap();
    fileId = file.id;
  });

  it('gets a file by ID', async () => {
    const result = await svc.getFile(ctx(), fileId);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().id).toBe(fileId);
  });

  it('returns NOT_FOUND for unknown file', async () => {
    const result = await svc.getFile(ctx(), 'unknown-id');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('deletes a file and soft-deletes the record', async () => {
    const result = await svc.deleteFile(ctx(), fileId);
    expect(result.isOk()).toBe(true);

    const afterDelete = await svc.getFile(ctx(), fileId);
    expect(afterDelete.isErr()).toBe(true); // soft deleted = NOT_FOUND for normal queries
  });

  it('bulk delete succeeds and returns results', async () => {
    const f2 = (
      await svc.uploadFile(
        ctx(),
        { bucketId, filename: 'f2.txt', sizeBytes: 3 },
        Buffer.from('bye'),
      )
    )._unsafeUnwrap();

    const result = await svc.bulkDelete(ctx(), [fileId, f2.id]);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().succeeded).toHaveLength(2);
    expect(result._unsafeUnwrap().failed).toHaveLength(0);
  });

  it('bulk delete rejects more than 1000 files', async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `file-${i}`);
    const result = await svc.bulkDelete(ctx(), ids);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('VALIDATION');
  });

  it('sets and retrieves tags on a file', async () => {
    const result = await svc.setTags(ctx(), fileId, ['important', 'hr']);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().tags).toContain('important');
    expect(result._unsafeUnwrap().tags).toContain('hr');
  });

  it('sets custom metadata on a file', async () => {
    const result = await svc.setMetadata(ctx(), fileId, { author: 'Alice', version: 2 });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().customMetadata).toEqual({ author: 'Alice', version: 2 });
  });
});

// ── Signed URLs ───────────────────────────────────────────────────────────────

describe('StorageService — signed URLs', () => {
  let svc: ReturnType<typeof makeService>['svc'];
  let fileId: string;

  beforeEach(async () => {
    const setup = makeService();
    svc = setup.svc;
    const bucket = (await svc.createBucket(ctx(), { name: 'B', slug: 'b' }))._unsafeUnwrap();
    const file = (
      await svc.uploadFile(
        ctx(),
        { bucketId: bucket.id, filename: 'f.pdf', sizeBytes: 10 },
        Buffer.alloc(10),
      )
    )._unsafeUnwrap();
    fileId = file.id;
  });

  it('creates a signed URL with a plain token', async () => {
    const result = await svc.createSignedUrl(ctx(), fileId, { ttlSeconds: 3600 });
    expect(result.isOk()).toBe(true);
    const record = result._unsafeUnwrap();
    expect(record.token).toBeTruthy();
    expect(record.token.length).toBe(64); // 32 bytes hex
    expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('resolves a valid signed URL token', async () => {
    const signedUrl = (await svc.createSignedUrl(ctx(), fileId, {}))._unsafeUnwrap();
    const resolved = await svc.resolveSignedUrl(signedUrl.token);
    expect(resolved.isOk()).toBe(true);
    expect(resolved._unsafeUnwrap().fileId).toBe(fileId);
  });

  it('rejects a revoked signed URL', async () => {
    const signedUrl = (await svc.createSignedUrl(ctx(), fileId, {}))._unsafeUnwrap();
    await svc.revokeSignedUrl(ctx(), signedUrl.id);

    const resolved = await svc.resolveSignedUrl(signedUrl.token);
    expect(resolved.isErr()).toBe(true);
    expect(resolved._unsafeUnwrapErr().code).toBe('FORBIDDEN');
  });

  it('rejects a non-existent token', async () => {
    const resolved = await svc.resolveSignedUrl('deadbeef'.repeat(8));
    expect(resolved.isErr()).toBe(true);
    expect(resolved._unsafeUnwrapErr().code).toBe('NOT_FOUND');
  });

  it('emits audit event on signed URL creation', async () => {
    const { svc: service, audit } = makeService();
    const b = (await service.createBucket(ctx(), { name: 'B', slug: 'b' }))._unsafeUnwrap();
    const f = (
      await service.uploadFile(
        ctx(),
        { bucketId: b.id, filename: 'f.txt', sizeBytes: 1 },
        Buffer.from('x'),
      )
    )._unsafeUnwrap();

    await service.createSignedUrl(ctx(), f.id, {});
    const ev = audit.events.find((e) => e.eventType === STORAGE_AUDIT_EVENTS.SIGNED_URL_CREATED);
    expect(ev).toBeDefined();
  });
});

// ── ACLs ─────────────────────────────────────────────────────────────────────

describe('StorageService — file ACLs', () => {
  let svc: ReturnType<typeof makeService>['svc'];
  let fileId: string;

  beforeEach(async () => {
    const setup = makeService();
    svc = setup.svc;
    const bucket = (await svc.createBucket(ctx(), { name: 'B', slug: 'b' }))._unsafeUnwrap();
    const file = (
      await svc.uploadFile(
        ctx(),
        { bucketId: bucket.id, filename: 'secret.docx', sizeBytes: 5 },
        Buffer.from('hello'),
      )
    )._unsafeUnwrap();
    fileId = file.id;
  });

  it('sets and removes a file ACL', async () => {
    const setResult = await svc.setFileAcl(ctx(), fileId, { 'user:alice': ['read'] });
    expect(setResult.isOk()).toBe(true);

    const removeResult = await svc.removeFileAcl(ctx(), fileId);
    expect(removeResult.isOk()).toBe(true);
  });

  it('emits audit events for ACL set and remove', async () => {
    const { svc: service, audit } = makeService();
    const b = (await service.createBucket(ctx(), { name: 'B', slug: 'b' }))._unsafeUnwrap();
    const f = (
      await service.uploadFile(
        ctx(),
        { bucketId: b.id, filename: 'f.txt', sizeBytes: 1 },
        Buffer.from('x'),
      )
    )._unsafeUnwrap();

    await service.setFileAcl(ctx(), f.id, { 'role:viewer': ['read'] });
    await service.removeFileAcl(ctx(), f.id);

    const setEv = audit.events.find((e) => e.eventType === STORAGE_AUDIT_EVENTS.ACL_SET);
    const remEv = audit.events.find((e) => e.eventType === STORAGE_AUDIT_EVENTS.ACL_REMOVED);
    expect(setEv).toBeDefined();
    expect(remEv).toBeDefined();
  });
});

// ── Quota ─────────────────────────────────────────────────────────────────────

describe('StorageService — quota', () => {
  it('returns quota for the workspace', async () => {
    const { svc } = makeService();

    const result = await svc.getQuota(ctx());
    expect(result.isOk()).toBe(true);
    const quota = result._unsafeUnwrap();
    expect(quota.workspaceId).toBe(WS);
    expect(quota.quotaBytes).toBeGreaterThan(0);
  });
});

// ── Folder operations ─────────────────────────────────────────────────────────

describe('StorageService — folder operations', () => {
  it('creates a folder placeholder in storage', async () => {
    const { svc, storage } = makeService();
    const bucket = (await svc.createBucket(ctx(), { name: 'B', slug: 'b' }))._unsafeUnwrap();

    const result = await svc.createFolder(ctx(), bucket.id, 'documents/reports');
    expect(result.isOk()).toBe(true);

    // A .keep object should exist in the in-memory storage
    const keepKey = [...storage.objects.keys()].find((k) => k.includes('.keep'));
    expect(keepKey).toBeTruthy();
  });
});
