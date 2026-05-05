/**
 * Session cookie helpers for Next.js route handlers.
 * The session token is stored in an HTTP-only, SameSite=Lax cookie.
 */
import type { Session } from '@platform/ports-identity';
import type { RequestContext } from '@platform/ports-authorization';

import { getEnv } from '@platform/config';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { getSessionAdapter } from './auth-service';

export const SESSION_COOKIE = 'lh_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getEnv().NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/** Verify the session cookie and return the session, or null if invalid/missing. */
export async function verifySessionFromCookies(): Promise<Session | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessions = getSessionAdapter();
  const result = await sessions.findByToken(token);
  if (result.isErr() || !result.value) return null;

  return result.value;
}

/** Verify the session from a raw Request object (for use in route handlers). */
export async function verifySessionFromRequest(request: Request): Promise<Session | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const token = parseCookieValue(cookieHeader, SESSION_COOKIE);
  if (!token) return null;

  const sessions = getSessionAdapter();
  const result = await sessions.findByToken(token);
  if (result.isErr() || !result.value) return null;

  return result.value;
}

/** Build a RequestContext from an incoming request with session verification. */
export async function requestContextFromSession(
  workspaceId: string,
  request: Request,
): Promise<RequestContext | null> {
  const session = await verifySessionFromRequest(request);
  if (!session) return null;

  const ip =
    request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined;
  const ua = request.headers.get('user-agent') ?? undefined;

  return {
    _kind: 'user',
    userId: session.userId,
    installationRoles: [],
    correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
    mfaSatisfied: false,
    workspaceId,
    ...(ip !== undefined && { ipAddress: ip }),
    ...(ua !== undefined && { userAgent: ua }),
  };
}

/** Build a system-level RequestContext for unauthenticated auth endpoints. */
export function systemContext(request: Request): { _kind: 'system'; correlationId: string } {
  return {
    _kind: 'system',
    correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
  };
}

function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k?.trim() === name) return rest.join('=').trim();
  }
  return undefined;
}
