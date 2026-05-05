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
  // Redirect to the underlying storage URL
  return NextResponse.redirect(result.value.storageUrl);
}
