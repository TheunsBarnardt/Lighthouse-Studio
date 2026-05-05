import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { requestContextFromSession } from '@/lib/server/session';
import { okResponse } from '@/lib/server/api-helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; key: string }> },
): Promise<NextResponse> {
  const { slug, key } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  const body = (await request.json()) as { subjectTemplate: string; htmlTemplate: string; textTemplate?: string };
  if (!body.subjectTemplate && !body.htmlTemplate) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'subjectTemplate or htmlTemplate is required.', statusCode: 400 }, { status: 400 });
  }

  // TODO: EmailTemplateService.setTemplateOverride(ctx, workspaceId, key, body)
  return okResponse({ message: `Template override saved for ${key}.` });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; key: string }> },
): Promise<NextResponse> {
  const { slug, key } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: EmailTemplateService.resetTemplateOverride(ctx, workspaceId, key)
  return okResponse({ message: `Template override removed for ${key}.` });
}
