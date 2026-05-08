import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { beginSso } from '@/lib/server/sso';

const KNOWN_PROVIDERS = new Set(['google', 'github', 'microsoft']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await params;
  const returnTo = request.nextUrl.searchParams.get('returnTo') ?? '/';

  if (!KNOWN_PROVIDERS.has(provider)) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: `Unknown SSO provider: ${provider}`, statusCode: 404 },
      { status: 404 },
    );
  }

  const authUrl = beginSso(provider, returnTo);
  if (!authUrl) {
    return NextResponse.json(
      {
        code: 'NOT_CONFIGURED',
        message: `${provider} SSO is not configured. Add ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET to your environment.`,
        statusCode: 503,
      },
      { status: 503 },
    );
  }

  return okResponse({ authUrl });
}
