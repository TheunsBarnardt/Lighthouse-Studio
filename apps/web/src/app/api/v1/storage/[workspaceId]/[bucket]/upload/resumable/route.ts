/**
 * SDK resumable upload create-session route:
 * POST /api/v1/storage/{workspace}/{bucket}/upload/resumable
 * Body: { filename, contentType, size, metadata? }
 * Returns: { uploadUrl, uploadId }
 */
import { NextResponse } from 'next/server';

import { createResumableSession } from '@/lib/server/sdk-store';

interface Params {
  workspaceId: string;
  bucket: string;
}

export async function POST(
  request: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { workspaceId, bucket } = params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  const uploadId = crypto.randomUUID();
  const filename = typeof body['filename'] === 'string' ? body['filename'] : 'upload';
  const contentType =
    typeof body['contentType'] === 'string' ? body['contentType'] : 'application/octet-stream';
  const size = typeof body['size'] === 'number' ? body['size'] : 0;

  createResumableSession({
    uploadId,
    filename,
    contentType,
    size,
    chunks: [],
    workspace: workspaceId,
    bucket,
  });

  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const baseUrl = `${proto}://${host}`;
  const uploadUrl = `${baseUrl}/api/v1/storage/${workspaceId}/${bucket}/upload/resumable/${uploadId}/chunk`;

  return NextResponse.json({ uploadUrl, uploadId });
}
