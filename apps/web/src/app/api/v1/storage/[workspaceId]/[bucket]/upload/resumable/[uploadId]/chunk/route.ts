/**
 * SDK resumable upload chunk route:
 * PATCH /api/v1/storage/{workspace}/{bucket}/upload/resumable/{uploadId}/chunk
 * Body: binary chunk
 * Headers: Upload-Offset, Content-Type: application/offset+octet-stream
 */
import { NextResponse } from 'next/server';

import { appendChunk, getResumableSession } from '@/lib/server/sdk-store';

interface Params {
  workspaceId: string;
  bucket: string;
  uploadId: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { uploadId } = params;
  const session = getResumableSession(uploadId);
  if (!session) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Upload session not found' },
      { status: 404 },
    );
  }

  const chunkBuffer = Buffer.from(await request.arrayBuffer());
  appendChunk(uploadId, chunkBuffer);

  const uploadOffset = request.headers.get('upload-offset');
  return new NextResponse(null, {
    status: 204,
    headers: { 'Upload-Offset': String(Number(uploadOffset ?? 0) + chunkBuffer.length) },
  });
}
