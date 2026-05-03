/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
import type {
  ListOptions,
  ListResult,
  ObjectInfo,
  ObjectStoragePort,
  PutOptions,
  Readable,
  StorageFeature,
  NotSupportedError,
} from '@platform/ports-storage';
import type { Result } from 'neverthrow';

import { StorageError } from '@platform/ports-storage';
import { err, ok } from 'neverthrow';

import type { AzureBlobStorageConfig } from './config.js';

/**
 * Object storage adapter backed by Azure Blob Storage.
 *
 * Authenticates via DefaultAzureCredential. Uses a single container with an
 * optional path prefix to namespace blobs.
 *
 * This is the recommended storage adapter for Windows / Azure deployments.
 * See Objective 09 (§6.2) and ADR-0084.
 */
export class AzureBlobStorageAdapter implements ObjectStoragePort {
  constructor(private readonly config: AzureBlobStorageConfig) {}

  private resolveKey(key: string): string {
    const prefix = this.config.pathPrefix ?? '';
    return prefix ? `${prefix}/${key}` : key;
  }

  async put(
    key: string,
    data: Readable | Buffer,
    _opts?: PutOptions,
  ): Promise<Result<ObjectInfo, StorageError>> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const credential = new DefaultAzureCredential();
      const serviceClient = new BlobServiceClient(this.config.accountUrl, credential);
      const containerClient = serviceClient.getContainerClient(this.config.containerName);
      const blobClient = containerClient.getBlockBlobClient(this.resolveKey(key));

      const uploadData = Buffer.isBuffer(data) ? data : await streamToBuffer(data);
      const response = await blobClient.upload(uploadData, uploadData.length);

      return ok({
        key,
        size: uploadData.length,
        etag: response.etag,
        lastModified: new Date(),
      });
    } catch (cause) {
      return err(new StorageError(`Failed to upload blob '${key}'`, cause));
    }
  }

  async get(key: string): Promise<Result<Readable, StorageError>> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const credential = new DefaultAzureCredential();
      const serviceClient = new BlobServiceClient(this.config.accountUrl, credential);
      const containerClient = serviceClient.getContainerClient(this.config.containerName);
      const blobClient = containerClient.getBlobClient(this.resolveKey(key));

      const downloadResponse = await blobClient.download();
      if (!downloadResponse.readableStreamBody) {
        return err(new StorageError(`Blob '${key}' returned empty stream`));
      }
      return ok(downloadResponse.readableStreamBody as Readable);
    } catch (cause) {
      return err(new StorageError(`Failed to download blob '${key}'`, cause));
    }
  }

  async head(key: string): Promise<Result<ObjectInfo | null, StorageError>> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const credential = new DefaultAzureCredential();
      const serviceClient = new BlobServiceClient(this.config.accountUrl, credential);
      const containerClient = serviceClient.getContainerClient(this.config.containerName);
      const blobClient = containerClient.getBlobClient(this.resolveKey(key));

      try {
        const props = await blobClient.getProperties();
        return ok({
          key,
          size: props.contentLength ?? 0,
          etag: props.etag,
          lastModified: props.lastModified ?? new Date(),
        });
      } catch {
        return ok(null);
      }
    } catch (cause) {
      return err(new StorageError(`Failed to head blob '${key}'`, cause));
    }
  }

  async delete(key: string): Promise<Result<void, StorageError>> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const credential = new DefaultAzureCredential();
      const serviceClient = new BlobServiceClient(this.config.accountUrl, credential);
      const containerClient = serviceClient.getContainerClient(this.config.containerName);
      const blobClient = containerClient.getBlobClient(this.resolveKey(key));

      await blobClient.deleteIfExists();
      return ok(undefined);
    } catch (cause) {
      return err(new StorageError(`Failed to delete blob '${key}'`, cause));
    }
  }

  async list(prefix: string, opts?: ListOptions): Promise<Result<ListResult, StorageError>> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const credential = new DefaultAzureCredential();
      const serviceClient = new BlobServiceClient(this.config.accountUrl, credential);
      const containerClient = serviceClient.getContainerClient(this.config.containerName);

      const resolvedPrefix = this.resolveKey(prefix);
      const items: ObjectInfo[] = [];
      const maxResults = opts?.maxKeys ?? 1000;

      for await (const blob of containerClient.listBlobsFlat({ prefix: resolvedPrefix })) {
        if (items.length >= maxResults) break;
        items.push({
          key: blob.name,
          size: blob.properties.contentLength ?? 0,
          etag: blob.properties.etag,
          lastModified: blob.properties.lastModified,
        });
      }

      return ok({ items, isTruncated: false });
    } catch (cause) {
      return err(new StorageError(`Failed to list blobs with prefix '${prefix}'`, cause));
    }
  }

  async signedUrl(
    key: string,
    method: 'GET' | 'PUT',
    opts: { expiresIn: number; contentType?: string },
  ): Promise<Result<string, StorageError | NotSupportedError>> {
    try {
      const { DefaultAzureCredential } = await import('@azure/identity');
      const { BlobServiceClient } = await import('@azure/storage-blob');

      const credential = new DefaultAzureCredential();
      const serviceClient = new BlobServiceClient(this.config.accountUrl, credential);
      const containerClient = serviceClient.getContainerClient(this.config.containerName);
      const blobClient = containerClient.getBlobClient(this.resolveKey(key));

      const expiresOn = new Date(Date.now() + opts.expiresIn * 1000);

      // generateSasUrl requires StorageSharedKeyCredential or user delegation key.
      // DefaultAzureCredential supports user delegation SAS on Azure-hosted VMs.
      const sasUrl = await blobClient.generateSasUrl({
        permissions:
          method === 'GET' ? ({ read: true } as never) : ({ write: true, create: true } as never),
        expiresOn,
        contentType: opts.contentType,
      });

      return ok(sasUrl);
    } catch (cause) {
      return err(new StorageError(`Failed to generate SAS URL for '${key}'`, cause));
    }
  }

  supports(feature: StorageFeature): boolean {
    return feature === 'signed-urls' || feature === 'metadata';
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
