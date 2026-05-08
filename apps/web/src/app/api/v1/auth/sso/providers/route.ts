import { NextResponse } from 'next/server';

import { ssoProviders } from '@/lib/server/sso';

export function GET(): NextResponse {
  return NextResponse.json({
    google: ssoProviders.google.enabled(),
    github: ssoProviders.github.enabled(),
    microsoft: ssoProviders.microsoft.enabled(),
  });
}
