/**
 * SDK resumable upload finalize route:
 * POST /api/v1/storage/{workspace}/{bucket}/upload/resumable/{uploadId}/finalize
 * Returns: FileRecord
 */
import { NextResponse } from 'next/server';

import { finalizeResumable, storeFile } from '@/lib/server/sdk-store';

interface Params {
  workspaceId: string;
  bucket: string;
  uploadId: string;
}

export function POST(_request: Request, { params }: { params: Params }): NextResponse {
  const { workspaceId, bucket, uploadId } = params;
  const session = finalizeResumable(uploadId);
  if (!session) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Upload session not found' },
      { status: 404 },
    );
  }

  const combined = Buffer.concat(session.chunks);
  const now = new Date().toISOString();
  const stored = storeFile(workspaceId, bucket, session.filename, {
    path: session.filename,
    bucket,
    workspace: workspaceId,
    size: combined.length,
    contentType: session.contentType,
    filename: session.filename,
    data: combined,
    createdAt: now,
  });

  return NextResponse.json({
    id: stored.id,
    name: session.filename,
    bucket,
    path: stored.path,
    size: stored.size,
    contentType: stored.contentType,
    createdAt: stored.createdAt,
    updatedAt: stored.createdAt,
  });
}
