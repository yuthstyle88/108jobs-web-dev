import { NextResponse } from 'next/server';
import { getVersionInfo } from '@/utils/version';

// VERSIONING_STANDARD.md §3: a web front end answers GET /api/version with
// version / build / builtAt / channel, so "which build is this?" needs no
// cluster access. A filesystem route here wins over next.config.ts's
// `/api/:path*` proxy rewrite (that runs afterFiles), and the locale proxy's
// matcher already excludes `api`, so this answers at the bare path.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getVersionInfo(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
