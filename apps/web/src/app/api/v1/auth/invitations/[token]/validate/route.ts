import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  // TODO: look up invitation by token hash via InvitationFlowService
  // Dev: accept any token starting with 'inv-'
  if (!token.startsWith('inv-')) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invitation not found or expired.', statusCode: 404 },
      { status: 404 },
    );
  }

  return okResponse({
    email: 'invited@example.com',
    workspaceName: 'Demo Workspace',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
}
