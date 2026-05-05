export interface MinioStorageConfig {
  /** S3-compatible endpoint URL (e.g. http://localhost:9000 or https://s3.amazonaws.com). */
  endpoint: string;
  /** AWS region or MinIO region. */
  region: string;
  /** Access key ID. */
  accessKeyId: string;
  /** Secret access key. */
  secretAccessKey: string;
  /** Bucket name. */
  bucket: string;
  /** Optional key prefix to namespace objects within the bucket. */
  keyPrefix?: string;
  /** Use path-style URLs instead of virtual-hosted-style (required for MinIO). Default true. */
  forcePathStyle?: boolean;
}
