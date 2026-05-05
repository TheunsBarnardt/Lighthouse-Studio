import { errorResponse, requestContext } from '@/lib/server/api-helpers';

interface Params {
  workspaceId: string;
}

// Export is a background job; this stub returns a not-yet-wired response.
// Full implementation wires JobQueuePort (Objective 23).
export async function POST(req: Request, { params }: { params: Params }) {
  void requestContext(params.workspaceId, req);
  void (await req.json());
  return errorResponse({
    code: 'NOT_IMPLEMENTED',
    message: 'Export requires the job queue adapter (Objective 23)',
    statusCode: 501,
  } as never);
}
