/**
 * SDK storage simple upload route: POST /api/v1/storage/{workspace}/{bucket}/upload
 * Body: multipart/form-data with field "file"
 * Returns: FileRecord { id, name, bucket, path, size, contentType, createdAt, updatedAt }
 */
import { NextResponse } from 'next/server';

import { storeFile } from '@/lib/server/sdk-store';

interface Params {
  workspaceId: string;
  bucket: string;
}

export async function POST(
  request: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { workspaceId, bucket } = params;

  let filename = 'upload';
  let contentType = 'application/octet-stream';
  let data: Buffer;

  const ct = request.headers.get('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Invalid form data' },
        { status: 400 },
      );
    }
    const fileField = formData.get('file');
    if (!fileField || !(fileField instanceof Blob)) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Missing file field' },
        { status: 400 },
      );
    }
    filename =
      fileField instanceof File
        ? fileField.name
        : ((formData.get('filename') as string | null) ?? 'upload');
    contentType =
      fileField.type ||
      ((formData.get('contentType') as string | null) ?? 'application/octet-stream');
    data = Buffer.from(await fileField.arrayBuffer());
  } else {
    // JSON body fallback (shouldn't happen with fixed SDK but kept for safety)
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      /* empty */
    }
    filename = typeof body['filename'] === 'string' ? body['filename'] : 'upload';
    contentType =
      typeof body['contentType'] === 'string' ? body['contentType'] : 'application/octet-stream';
    data = Buffer.alloc(0);
  }

  const now = new Date().toISOString();
  const stored = storeFile(workspaceId, bucket, filename, {
    path: filename,
    bucket,
    workspace: workspaceId,
    size: data.length,
    contentType,
    filename,
    data,
    createdAt: now,
  });

  return NextResponse.json({
    id: stored.id,
    name: filename,
    bucket,
    path: stored.path,
    size: stored.size,
    contentType: stored.contentType,
    createdAt: stored.createdAt,
    updatedAt: stored.createdAt,
  });
}
