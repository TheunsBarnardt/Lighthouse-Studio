import { runObjectStorageConformance } from '@platform/ports-storage/conformance';
import { describe, it } from 'vitest';

import { AzureBlobStorageAdapter } from '../src/index.js';

const { AZURE_STORAGE_ACCOUNT_URL, AZURE_STORAGE_CONTAINER_NAME } = process.env;

const hasCredentials = !!AZURE_STORAGE_ACCOUNT_URL && !!AZURE_STORAGE_CONTAINER_NAME;

if (hasCredentials) {
  runObjectStorageConformance('AzureBlobStorageAdapter', () =>
    Promise.resolve(
      new AzureBlobStorageAdapter({
        accountUrl: AZURE_STORAGE_ACCOUNT_URL,
        containerName: AZURE_STORAGE_CONTAINER_NAME,
        pathPrefix: `conformance-test-${Date.now()}`,
      }),
    ),
  );
} else {
  describe('AzureBlobStorageAdapter — ObjectStoragePort conformance', () => {
    it.skip('skipped: set AZURE_STORAGE_ACCOUNT_URL and AZURE_STORAGE_CONTAINER_NAME to enable', () => {});
  });
}
