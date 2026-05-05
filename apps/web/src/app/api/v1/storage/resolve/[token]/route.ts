import { NextResponse } from 'next/server';

import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  token: string;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  const result = await getStorageService().resolveSignedUrl(params.token);
  if (result.isErr()) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invalid or expired token' },
      { status: 404 },
    );
  }

  const { storageUrl, cachePublic } = result.value;

  const response = NextResponse.redirect(storageUrl);

  if (cachePublic) {
    // Public files may be served via CDN — allow shared caching for 1 hour.
    // max-age matches the default signed URL TTL so the cached response stays
    // valid within the URL's lifetime.
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  } else {
    // Private files must not be cached in shared caches.
    response.headers.set('Cache-Control', 'private, no-store');
  }

  return response;
}
