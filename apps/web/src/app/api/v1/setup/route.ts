import { makeSystemContext } from '@platform/core';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { okResponse } from '@/lib/server/api-helpers';
import { getAuthService, getUserDirectory } from '@/lib/server/auth-service';
import { setSessionCookie } from '@/lib/server/session';

const SetupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(255),
  workspaceName: z.string().min(1).max(255),
});

export async function POST(request: Request): Promise<NextResponse> {
  // Guard: only works when no users exist
  const directory = getUserDirectory();
  const existing = await directory.search({ status: 'all', limit: 1 });
  if (existing.isOk() && existing.value.total > 0) {
    return NextResponse.json(
      { code: 'CONFLICT', message: 'Installation already initialized.', statusCode: 409 },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: 'VALIDATION', message: 'Invalid JSON', statusCode: 400 },
      { status: 400 },
    );
  }

  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: 'VALIDATION',
        message: parsed.error.issues[0]?.message ?? 'Invalid input',
        statusCode: 400,
      },
      { status: 400 },
    );
  }

  // Create installation owner user
  const createResult = await directory.create({
    email: parsed.data.email,
    displayName: parsed.data.displayName,
    identity: {
      providerId: 'builtin',
      subject: parsed.data.email,
      email: parsed.data.email,
      emailVerified: true,
      primary: true,
    },
    preferences: {},
  });

  if (createResult.isErr()) {
    return NextResponse.json(
      { code: 'CONFLICT', message: 'Failed to create installation owner.', statusCode: 409 },
      { status: 409 },
    );
  }

  const user = createResult.value;

  // Sign the new user in immediately
  const ctx = makeSystemContext('auth.setup', randomUUID());
  const authService = getAuthService();

  const beginResult = await authService.beginSignIn(ctx, {
    method: 'password',
    email: parsed.data.email,
    password: parsed.data.password,
  });

  let token = '';
  if (beginResult.isOk() && beginResult.value.challenge.kind === 'complete') {
    const completeResult = await authService.completeSignIn(ctx, { method: 'password' });
    if (completeResult.isOk()) {
      token = completeResult.value.token;
    }
  }

  // TODO: create the first workspace via WorkspaceService

  const response = okResponse({
    id: user.id,
    email: user.primaryEmail,
    displayName: user.displayName,
    status: 'active',
    mfaEnabled: false,
    identities: [{ providerId: 'builtin', email: user.primaryEmail, primary: true }],
    preferences: user.preferences,
    avatarUrl: null,
  });

  if (token) setSessionCookie(response, token);
  return response;
}
