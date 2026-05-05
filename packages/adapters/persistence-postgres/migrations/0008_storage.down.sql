-- Rollback migration 0008: storage

DROP TABLE IF EXISTS signed_urls;
DROP TABLE IF EXISTS file_acls;
DROP TABLE IF EXISTS file_records;
DROP TABLE IF EXISTS storage_quotas;
DROP TABLE IF EXISTS storage_buckets;
