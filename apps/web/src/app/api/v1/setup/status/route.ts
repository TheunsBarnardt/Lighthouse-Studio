import { NextResponse } from 'next/server';

import { okResponse } from '@/lib/server/api-helpers';
import { getUserDirectory } from '@/lib/server/auth-service';

export async function GET(): Promise<NextResponse> {
  const directory = getUserDirectory();
  // Check if any users exist
  const result = await directory.search({ status: 'all', limit: 1 });
  const initialized = result.isOk() && result.value.total > 0;
  return okResponse({ initialized });
}
