export interface AzureBlobStorageConfig {
  /** Azure Storage account URL (e.g. https://myaccount.blob.core.windows.net). */
  accountUrl: string;
  /** Container name for platform artifacts. */
  containerName: string;
  /** Optional path prefix to namespace blobs within the container. */
  pathPrefix?: string;
}
