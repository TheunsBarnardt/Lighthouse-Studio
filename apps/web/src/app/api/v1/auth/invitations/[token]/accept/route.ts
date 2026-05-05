import type { NextRequest } from 'next/server';

import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { verifySessionFromRequest } from '@/lib/server/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const session = await verifySessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Sign in to accept this invitation.', statusCode: 401 }, { status: 401 });
  }

  const { token } = await params;

  if (!token.startsWith('inv-')) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: 'Invitation not found or expired.', statusCode: 404 },
      { status: 404 },
    );
  }

  // TODO: invoke InvitationFlowService.acceptInvitation
  return okResponse({ workspaceId: 'demo-workspace-id', workspaceSlug: 'demo' });
}
