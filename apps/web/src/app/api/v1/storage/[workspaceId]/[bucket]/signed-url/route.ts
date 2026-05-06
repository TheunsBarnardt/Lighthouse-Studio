/**
 * SDK storage signed URL route: POST /api/v1/storage/{workspace}/{bucket}/signed-url
 * Body: { fileId: string, expiresIn?: string }
 * Returns: { url: string }
 */
import { NextResponse } from 'next/server';

import { createSignedToken } from '@/lib/server/sdk-store';

interface Params {
  workspaceId: string;
  bucket: string;
}

function parseExpiresIn(expiresIn: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(expiresIn);
  if (!match || !match[1] || !match[2]) return 3600;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === 's') return n;
  if (unit === 'm') return n * 60;
  if (unit === 'h') return n * 3600;
  if (unit === 'd') return n * 86400;
  return 3600;
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

  const fileId = typeof body['fileId'] === 'string' ? body['fileId'] : '';
  if (!fileId) {
    return NextResponse.json({ code: 'VALIDATION', message: 'fileId required' }, { status: 400 });
  }

  const expiresInSec = parseExpiresIn(
    typeof body['expiresIn'] === 'string' ? body['expiresIn'] : '1h',
  );
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  createSignedToken(token, { fileId, workspace: workspaceId, bucket, expiresAt });

  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/v1/storage/inline/${token}`;

  return NextResponse.json({ url });
}
