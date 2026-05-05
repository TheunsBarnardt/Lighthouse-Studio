import { NextResponse } from 'next/server';

import { errorResponse, okResponse, requestContext } from '@/lib/server/api-helpers';
import { getStorageService } from '@/lib/server/storage-service';

interface Params {
  workspaceId: string;
}

export async function GET(req: Request, { params }: { params: Params }) {
  const url = new URL(req.url);
  const bucketId = url.searchParams.get('bucketId') ?? undefined;
  const folderPath = url.searchParams.get('folderPath') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;
  const limit = Number(url.searchParams.get('limit') ?? '50');
  const offset = Number(url.searchParams.get('offset') ?? '0');

  const ctx = requestContext(params.workspaceId, req);
  const result = await getStorageService().listFiles(ctx, {
    ...(bucketId !== undefined ? { bucketId } : {}),
    ...(folderPath !== undefined ? { folderPath } : {}),
    ...(search !== undefined ? { search } : {}),
    limit,
    offset,
  });
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value);
}

export async function POST(req: Request, { params }: { params: Params }) {
  const ctx = requestContext(params.workspaceId, req);
  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('file');
    const bucketIdRaw = form.get('bucketId');
    const folderPathRaw = form.get('folderPath');
    const bucketId = typeof bucketIdRaw === 'string' ? bucketIdRaw : '';
    const folderPath = typeof folderPathRaw === 'string' ? folderPathRaw : '';

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'No file provided' },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const result = await getStorageService().uploadFile(
      ctx,
      {
        bucketId,
        folderPath: folderPath || '',
        filename: file.name,
        sizeBytes: file.size,
        ...(file.type ? { contentType: file.type } : {}),
      },
      buf,
    );
    if (result.isErr()) return errorResponse(result.error);
    return okResponse(result.value, 201);
  }

  const body: unknown = await req.json();
  const result = await getStorageService().uploadFile(ctx, body as never, Buffer.alloc(0));
  if (result.isErr()) return errorResponse(result.error);
  return okResponse(result.value, 201);
}
