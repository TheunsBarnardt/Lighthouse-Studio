/**
 * SDK storage inline download route: GET /api/v1/storage/inline/{token}
 * Serves the file bytes directly (for signed URL downloads).
 */
import { NextResponse } from 'next/server';

import { getFile, resolveSignedToken } from '@/lib/server/sdk-store';

interface Params {
  token: string;
}

export function GET(_request: Request, { params }: { params: Params }): NextResponse {
  const meta = resolveSignedToken(params.token);
  if (!meta) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invalid or expired token' },
      { status: 404 },
    );
  }

  const file = getFile(meta.workspace, meta.bucket, meta.fileId);
  if (!file) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'File not found' }, { status: 404 });
  }

  return new NextResponse(file.data, {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.size),
      'Cache-Control': 'private, no-store',
    },
  });
}
