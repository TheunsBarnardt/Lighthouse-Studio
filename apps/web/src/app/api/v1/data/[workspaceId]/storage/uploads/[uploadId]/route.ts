import { createTusServerForWorkspace } from '@/lib/server/tus';

interface Params {
  workspaceId: string;
  uploadId: string;
}

// tus protocol: HEAD returns the current upload offset.
export async function HEAD(req: Request, { params }: { params: Params }) {
  const server = createTusServerForWorkspace(params.workspaceId);
  return server.handleWeb(req);
}

// tus protocol: PATCH uploads a chunk.
export async function PATCH(req: Request, { params }: { params: Params }) {
  const server = createTusServerForWorkspace(params.workspaceId);
  return server.handleWeb(req);
}

// tus protocol: DELETE terminates (aborts) an in-progress upload.
export async function DELETE(req: Request, { params }: { params: Params }) {
  const server = createTusServerForWorkspace(params.workspaceId);
  return server.handleWeb(req);
}
