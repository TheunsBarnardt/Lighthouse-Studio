import type { Readable } from 'node:stream';

export type StorageFeature =
  | 'signed_urls'
  | 'multipart'
  | 'versioning'
  | 'object_locks'
  | 'public_read';

export interface ObjectInfo {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified: Date;
  metadata?: Record<string, string>;
}

export interface PutOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  acl?: 'private' | 'public-read';
}

export interface ListOptions {
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListResult {
  objects: ObjectInfo[];
  continuationToken?: string;
  isTruncated: boolean;
}

export interface StorageMetadata {
  id: string;
  key: string;
  workspaceId: string;
  uploadedBy: string;
  contentType?: string;
  size: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type { Readable };
