import { ObjectId } from 'mongodb';

import { runPlatformVersionConformance } from '@platform/ports-platform-version/conformance';

import { MongoPlatformVersionAdapter } from '../src/index.js';

// Simulates a MongoDB Db + collection in-memory so tests run without a real server.
function makeDb() {
  interface Doc {
    _id: ObjectId;
    release_version: string;
    applied_at: Date;
    applied_by?: string;
    schema_migration_high_water?: string;
    notes?: string;
  }

  const docs: Doc[] = [];

  const sorted = () =>
    [...docs].sort((a, b) => b.applied_at.getTime() - a.applied_at.getTime());

  const col = {
    findOne: async (_filter: object, options?: { sort?: Record<string, number> }) => {
      const s = sorted();
      return s[0] ?? null;
    },
    find: (_filter: object) => ({
      sort: (_s: object) => ({
        toArray: async () => sorted(),
      }),
    }),
    insertOne: async (doc: Omit<Doc, '_id'>) => {
      const inserted = { ...doc, _id: new ObjectId() } as Doc;
      docs.push(inserted);
      return { insertedId: inserted._id };
    },
    deleteOne: async (filter: { _id: ObjectId }) => {
      const idx = docs.findIndex((d) => d._id.equals(filter._id));
      if (idx !== -1) docs.splice(idx, 1);
      return { deletedCount: 1 };
    },
  };

  return {
    collection: (_name: string) => col,
  } as unknown as import('mongodb').Db;
}

runPlatformVersionConformance('MongoPlatformVersionAdapter', async () => {
  return new MongoPlatformVersionAdapter(makeDb());
});
