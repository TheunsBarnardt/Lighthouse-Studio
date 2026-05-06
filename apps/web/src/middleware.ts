import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { SESSION_COOKIE } from './lib/server/session-constants';

/** Routes that require authentication. */
const PROTECTED_PREFIXES = ['/account', '/workspaces', '/admin'];

/** Routes always accessible (auth pages, public). */
const PUBLIC_PREFIXES = ['/auth', '/setup', '/api', '/_next', '/favicon', '/manifest'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = '/auth/sign-in';
    signIn.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(signIn);
  }

  // Token present — full verification happens in the route handler.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
};
