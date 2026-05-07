/**
 * SDK storage file DELETE route: DELETE /api/v1/storage/{workspace}/{bucket}/files/{...path}
 */
import { NextResponse } from 'next/server';

import { deleteFile } from '@/lib/server/sdk-store';

interface Params {
  workspaceId: string;
  bucket: string;
  path: string[];
}

export function DELETE(_request: Request, { params }: { params: Params }): NextResponse {
  const { workspaceId, bucket, path } = params;
  const filePath = Array.isArray(path) ? path.join('/') : path;
  deleteFile(workspaceId, bucket, filePath);
  return NextResponse.json({ deleted: true });
}
