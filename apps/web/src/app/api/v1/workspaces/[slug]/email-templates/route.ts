import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { requestContextFromSession } from '@/lib/server/session';
import { okResponse } from '@/lib/server/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: EmailTemplateService.listOverrides(workspaceId, ctx)
  return okResponse({ overrides: {} });
}
