import { createTusServerForWorkspace } from '@/lib/server/tus';

interface Params {
  workspaceId: string;
}

// tus protocol: POST creates a new upload session.
export async function POST(req: Request, { params }: { params: Params }) {
  const server = createTusServerForWorkspace(params.workspaceId);
  return server.handleWeb(req);
}

// tus protocol: OPTIONS returns allowed methods and tus version headers.
export async function OPTIONS(req: Request, { params }: { params: Params }) {
  const server = createTusServerForWorkspace(params.workspaceId);
  return server.handleWeb(req);
}
