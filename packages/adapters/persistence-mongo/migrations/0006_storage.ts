import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    // ── storage_buckets ──────────────────────────────────────────────────────

    const buckets = db.collection('storage_buckets');

    await buckets.createIndex({ workspace_id: 1 }, { name: 'idx_storage_buckets_workspace' });

    await buckets.createIndex(
      { workspace_id: 1, slug: 1 },
      { unique: true, name: 'idx_storage_buckets_workspace_slug' },
    );

    await db.command({
      collMod: 'storage_buckets',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['workspace_id', 'name', 'slug', 'storage_class'],
          properties: {
            workspace_id: { bsonType: 'string', minLength: 1 },
            name: { bsonType: 'string', minLength: 1 },
            slug: { bsonType: 'string', minLength: 1 },
            storage_class: { enum: ['standard', 'infrequent', 'archive'] },
            default_pii_flag: { bsonType: 'bool' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'warn',
    });

    // ── file_records ─────────────────────────────────────────────────────────

    const files = db.collection('file_records');

    await files.createIndex(
      { workspace_id: 1, bucket_id: 1, folder_path: 1 },
      { name: 'idx_file_records_bucket_folder' },
    );

    await files.createIndex(
      { workspace_id: 1, filename: 1 },
      { name: 'idx_file_records_workspace_filename' },
    );

    await files.createIndex(
      { uploader_user_id: 1 },
      { sparse: true, name: 'idx_file_records_uploader' },
    );

    await files.createIndex(
      { workspace_id: 1, tags: 1 },
      { sparse: true, name: 'idx_file_records_tags' },
    );

    await db.command({
      collMod: 'file_records',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: [
            'workspace_id',
            'bucket_id',
            'storage_key',
            'filename',
            'size_bytes',
            'status',
          ],
          properties: {
            workspace_id: { bsonType: 'string', minLength: 1 },
            bucket_id: { bsonType: 'string', minLength: 1 },
            storage_key: { bsonType: 'string', minLength: 1 },
            filename: { bsonType: 'string', minLength: 1 },
            size_bytes: { bsonType: 'long', minimum: 0 },
            status: { enum: ['uploading', 'available', 'archiving', 'deleted'] },
            tags: { bsonType: 'array' },
            pii_flag: { bsonType: 'bool' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'warn',
    });

    // ── file_acls ────────────────────────────────────────────────────────────

    const acls = db.collection('file_acls');

    await acls.createIndex({ file_id: 1 }, { unique: true, name: 'idx_file_acls_file' });

    // ── signed_urls ──────────────────────────────────────────────────────────

    const signedUrls = db.collection('signed_urls');

    await signedUrls.createIndex(
      { token_hash: 1 },
      { unique: true, name: 'idx_signed_urls_token' },
    );

    await signedUrls.createIndex({ file_id: 1 }, { name: 'idx_signed_urls_file' });

    await signedUrls.createIndex({ expires_at: 1 }, { name: 'idx_signed_urls_expires' });

    // TTL index: MongoDB auto-removes expired, revoked signed URL docs
    await signedUrls.createIndex(
      { expires_at: 1 },
      { expireAfterSeconds: 604800, name: 'ttl_signed_urls_cleanup' }, // retain 7 days after expiry
    );

    await db.command({
      collMod: 'signed_urls',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['workspace_id', 'file_id', 'token_hash', 'expires_at'],
          properties: {
            token_hash: { bsonType: 'string', minLength: 64, maxLength: 64 },
            expires_at: { bsonType: 'date' },
            download_count: { bsonType: 'int', minimum: 0 },
            direct_mode: { bsonType: 'bool' },
          },
        },
      },
      validationLevel: 'strict',
      validationAction: 'error',
    });

    // ── storage_quotas ───────────────────────────────────────────────────────

    const quotas = db.collection('storage_quotas');

    await quotas.createIndex(
      { workspace_id: 1 },
      { unique: true, name: 'idx_storage_quotas_workspace' },
    );

    await db.command({
      collMod: 'storage_quotas',
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['workspace_id', 'quota_bytes', 'used_bytes'],
          properties: {
            workspace_id: { bsonType: 'string', minLength: 1 },
            quota_bytes: { bsonType: 'long', minimum: 0 },
            used_bytes: { bsonType: 'long', minimum: 0 },
            warning_sent_80: { bsonType: 'bool' },
            warning_sent_95: { bsonType: 'bool' },
          },
        },
      },
      validationLevel: 'moderate',
      validationAction: 'warn',
    });
  },

  async down(db: Db): Promise<void> {
    for (const name of [
      'signed_urls',
      'file_acls',
      'file_records',
      'storage_quotas',
      'storage_buckets',
    ]) {
      await db
        .collection(name)
        .drop()
        .catch(() => undefined);
    }
  },
};

export default migration;
