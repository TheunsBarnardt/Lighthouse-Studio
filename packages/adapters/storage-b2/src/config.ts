export interface B2StorageConfig {
  /** Backblaze B2 application key ID. */
  applicationKeyId: string;
  /** Backblaze B2 application key. */
  applicationKey: string;
  /** B2 bucket name. */
  bucketName: string;
  /** B2 bucket ID. */
  bucketId: string;
  /** Optional key prefix to namespace objects within the bucket. */
  keyPrefix?: string;
}
