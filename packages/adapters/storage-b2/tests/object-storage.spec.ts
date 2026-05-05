import { runObjectStorageConformance } from '@platform/ports-storage/conformance';
import { describe, it } from 'vitest';

import { B2StorageAdapter } from '../src/index.js';

const { B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_BUCKET_ID } = process.env;

const hasCredentials =
  !!B2_APPLICATION_KEY_ID && !!B2_APPLICATION_KEY && !!B2_BUCKET_NAME && !!B2_BUCKET_ID;

if (hasCredentials) {
  runObjectStorageConformance('B2StorageAdapter', () =>
    Promise.resolve(
      new B2StorageAdapter({
        applicationKeyId: B2_APPLICATION_KEY_ID,
        applicationKey: B2_APPLICATION_KEY,
        bucketName: B2_BUCKET_NAME,
        bucketId: B2_BUCKET_ID,
        keyPrefix: `conformance-test-${Date.now()}`,
      }),
    ),
  );
} else {
  describe('B2StorageAdapter — ObjectStoragePort conformance', () => {
    it.skip('skipped: set B2_APPLICATION_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_BUCKET_ID to enable', () => {});
  });
}
