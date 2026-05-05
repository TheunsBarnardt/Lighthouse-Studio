import type { Readable } from 'node:stream';

import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
  fileId: string;
}

const IMAGE_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
]);

/**
 * Sharp-based image transformer injected into the storage service.
 * Generates a medium (512px) JPEG thumbnail.
 * Sharp is an optional peer — if not available, falls back to the original.
 */
async function sharpTransform(stream: Readable, _contentType: string): Promise<Buffer> {
  // Dynamic import so sharp's native bindings don't crash if unavailable
  const sharp = (await import('sharp')).default;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  const input = Buffer.concat(chunks);
  return sharp(input)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function GET(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);
  const svc = getStorageService();

  // Get file metadata to determine content type
  const fileResult = await svc.getFile(ctx, params.fileId);
  if (fileResult.isErr()) return errorResponse(fileResult.error);

  const file = fileResult.value;
  const isImage = file.contentType && IMAGE_CONTENT_TYPES.has(file.contentType);

  if (isImage) {
    // Generate thumbnail on first view; return cached URL on subsequent views
    const thumbResult = await svc.getOrGenerateThumbnailUrl(
      ctx,
      params.fileId,
      'medium',
      sharpTransform,
    );
    if (thumbResult.isOk()) {
      return okResponse({ url: thumbResult.value, type: 'thumbnail' });
    }
    // Fall through to original if thumbnail generation fails
  }

  // For non-image files (or thumbnail failure): 5-minute signed URL to original
  const signedResult = await svc.createSignedUrl(ctx, params.fileId, {
    ttlSeconds: 300,
    description: 'preview',
  });
  if (signedResult.isErr()) return errorResponse(signedResult.error);

  const origin = new URL(req.url).origin;
  return okResponse({
    url: `${origin}/api/v1/storage/resolve/${signedResult.value.token}`,
    type: 'original',
  });
}
