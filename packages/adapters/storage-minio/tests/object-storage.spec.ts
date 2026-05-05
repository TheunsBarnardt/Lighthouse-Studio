import { runObjectStorageConformance } from '@platform/ports-storage/conformance';
import { describe, it } from 'vitest';

import { MinioStorageAdapter } from '../src/index.js';

const { MINIO_ENDPOINT, MINIO_REGION, MINIO_ACCESS_KEY_ID, MINIO_SECRET_ACCESS_KEY, MINIO_BUCKET } =
  process.env;

const hasCredentials =
  !!MINIO_ENDPOINT && !!MINIO_ACCESS_KEY_ID && !!MINIO_SECRET_ACCESS_KEY && !!MINIO_BUCKET;

if (hasCredentials) {
  runObjectStorageConformance('MinioStorageAdapter', () =>
    Promise.resolve(
      new MinioStorageAdapter({
        endpoint: MINIO_ENDPOINT,
        region: MINIO_REGION ?? 'us-east-1',
        accessKeyId: MINIO_ACCESS_KEY_ID,
        secretAccessKey: MINIO_SECRET_ACCESS_KEY,
        bucket: MINIO_BUCKET,
        keyPrefix: `conformance-test-${Date.now()}`,
        forcePathStyle: true,
      }),
    ),
  );
} else {
  describe('MinioStorageAdapter — ObjectStoragePort conformance', () => {
    it.skip('skipped: set MINIO_ENDPOINT, MINIO_ACCESS_KEY_ID, MINIO_SECRET_ACCESS_KEY, MINIO_BUCKET to enable', () => {});
  });
}
