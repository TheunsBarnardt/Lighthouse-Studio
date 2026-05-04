/**
 * CustomerTableRepository conformance tests — MongoDB adapter.
 *
 * Requires a live MongoDB instance.
 * Connection: MONGODB_URL environment variable.
 *
 *   MONGODB_URL=mongodb://localhost:27017/ pnpm test
 *
 * Tests are skipped automatically when no URL is set.
 */
import { MongoClient } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  MongoCustomerRepositoryProvider,
  ARCHIVE_FIELD,
  VERSION_FIELD,
} from '../src/customer-repository.adapter.js';

const MONGODB_URL = process.env['MONGODB_URL'];

const TEST_DB = 'pf_conformance_test';
const TEST_NS = 'cust_test_cr__'; // namespace with Mongo suffix
const TEST_TABLE = 'users';
const PK = 'id';

let client: MongoClient | undefined;

beforeAll(async () => {
  if (!MONGODB_URL) {
    process.stdout.write('Skipping MongoDB CustomerRepository tests — no MONGODB_URL set\n');
    return;
  }

  try {
    client = new MongoClient(MONGODB_URL);
    await client.connect();
    // Ensure index on PK for the test collection
    const col = client.db(TEST_DB).collection(`${TEST_NS}${TEST_TABLE}`);
    await col.createIndex({ [PK]: 1 }, { unique: true });
  } catch (e) {
    process.stderr.write(`MongoDB setup failed: ${String(e)}\n`);
    await client?.close();
    client = undefined;
  }
});

afterAll(async () => {
  if (!client) return;
  try {
    await client.db(TEST_DB).dropDatabase();
  } finally {
    await client.close();
  }
});

describe.skipIf(!MONGODB_URL)('MongoCustomerRepositoryProvider — CustomerTableRepository', () => {
  function makeRepo() {
    if (!client) throw new Error('Client not initialised');
    const db = client.db(TEST_DB);
    return new MongoCustomerRepositoryProvider(db).buildRepository({
      namespace: TEST_NS,
      tableName: TEST_TABLE,
      primaryKeyColumn: PK,
      columnNames: [PK, 'name', 'age'],
    });
  }

  async function clear() {
    if (!client) return;
    await client.db(TEST_DB).collection(`${TEST_NS}${TEST_TABLE}`).deleteMany({});
  }

  it('creates and retrieves a row by id', async () => {
    await clear();
    const repo = makeRepo();
    const r = await repo.create({ id: 'u1', name: 'Alice', age: 30 });
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()['name']).toBe('Alice');

    const found = await repo.findById('u1');
    expect(found._unsafeUnwrap()?.['name']).toBe('Alice');
  });

  it('returns null for a non-existent id', async () => {
    await clear();
    const repo = makeRepo();
    const r = await repo.findById('does-not-exist');
    expect(r._unsafeUnwrap()).toBeNull();
  });

  it('returns empty list when collection is empty', async () => {
    await clear();
    const repo = makeRepo();
    const r = await repo.findMany();
    expect(r._unsafeUnwrap().items).toHaveLength(0);
    expect(r._unsafeUnwrap().total).toBe(0);
  });

  it('lists all documents', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    await repo.create({ id: 'u2', name: 'Bob' });
    const r = await repo.findMany();
    expect(r._unsafeUnwrap().total).toBe(2);
  });

  it('filters by equality', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    await repo.create({ id: 'u2', name: 'Bob' });
    const r = await repo.findMany({ filter: { name: { _eq: 'Alice' } } });
    expect(r._unsafeUnwrap().items).toHaveLength(1);
    expect(r._unsafeUnwrap().items[0]?.['name']).toBe('Alice');
  });

  it('counts documents', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'A' });
    await repo.create({ id: 'u2', name: 'B' });
    const r = await repo.count();
    expect(r._unsafeUnwrap()).toBe(2);
  });

  it('updates a document', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice', age: 30 });
    const r = await repo.update('u1', { age: 31 });
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()['age']).toBe(31);
  });

  it('optimistic locking blocks stale update', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    await repo.update('u1', { name: 'Alice v2' }, { expectedVersion: 1 });
    // Version is now 2; trying again with version 1 should fail
    const r = await repo.update('u1', { name: 'Alice v3' }, { expectedVersion: 1 });
    expect(r.isErr()).toBe(true);
    expect(r._unsafeUnwrapErr().code).toBe('CONFLICT');
  });

  it('archives a document (soft delete)', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    const archiveR = await repo.archive('u1');
    expect(archiveR.isOk()).toBe(true);

    // Not in default list
    const list = await repo.findMany();
    expect(list._unsafeUnwrap().items).toHaveLength(0);

    // Not in findById
    const found = await repo.findById('u1');
    expect(found._unsafeUnwrap()).toBeNull();

    // Visible with includeArchived
    const archived = await repo.findMany({ includeArchived: true });
    expect(archived._unsafeUnwrap().items).toHaveLength(1);
  });

  it('restores an archived document', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    await repo.archive('u1');
    await repo.restore('u1');

    const found = await repo.findById('u1');
    expect(found._unsafeUnwrap()).not.toBeNull();
  });

  it('hard deletes a document', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    await repo.hardDelete('u1');
    const r = await repo.findMany({ includeArchived: true });
    expect(r._unsafeUnwrap().items).toHaveLength(0);
  });

  it('archive returns EntityNotFoundError for unknown id', async () => {
    await clear();
    const repo = makeRepo();
    const r = await repo.archive('no-such-id');
    expect(r.isErr()).toBe(true);
  });

  it('bulk creates documents', async () => {
    await clear();
    const repo = makeRepo();
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `u${String(i)}`,
      name: `User ${String(i)}`,
    }));
    const r = await repo.bulkCreate(rows);
    expect(r.isOk()).toBe(true);
    expect(r._unsafeUnwrap()).toHaveLength(5);
    expect((await repo.count())._unsafeUnwrap()).toBe(5);
  });

  it('rejects bulk create over limit', async () => {
    await clear();
    const repo = makeRepo();
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `u${String(i)}`,
      name: `U${String(i)}`,
    }));
    const r = await repo.bulkCreate(rows, { maxRows: 5 });
    expect(r.isErr()).toBe(true);
  });

  it('bulk updates documents matching filter', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice', age: 25 });
    await repo.create({ id: 'u2', name: 'Bob', age: 25 });
    await repo.create({ id: 'u3', name: 'Carol', age: 30 });
    const r = await repo.bulkUpdate({ age: { _eq: 25 } }, { age: 26 });
    expect(r._unsafeUnwrap().affectedCount).toBe(2);
  });

  it('bulk archives documents matching filter', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    await repo.create({ id: 'u2', name: 'Bob' });
    await repo.bulkDelete({});
    expect((await repo.count())._unsafeUnwrap()).toBe(0);
  });

  it('does not return system fields in document data', async () => {
    await clear();
    const repo = makeRepo();
    await repo.create({ id: 'u1', name: 'Alice' });
    const r = await repo.findById('u1');
    const row = r._unsafeUnwrap()!;
    expect(Object.keys(row)).not.toContain(ARCHIVE_FIELD);
    expect(Object.keys(row)).not.toContain(VERSION_FIELD);
    expect(Object.keys(row)).not.toContain('_id');
  });
});
