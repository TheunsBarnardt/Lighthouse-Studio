import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { requestContextFromSession } from '@/lib/server/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: BrandingService.getBranding
  return okResponse({ primaryColor: null, companyName: null, logoFileId: null, customCss: null, emailFromName: null });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const ctx = await requestContextFromSession(slug, request);
  if (!ctx) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated.', statusCode: 401 }, { status: 401 });
  }

  // TODO: BrandingService.setBranding
  return okResponse({ message: 'Branding saved.' });
}
