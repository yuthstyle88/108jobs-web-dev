import { NextResponse } from 'next/server';
import { fetchBackendVersion, getVersionInfo, type VersionInfo } from '@/utils/version';

// VERSIONING_STANDARD.md §3: a web front end answers GET /api/version with
// version / build / builtAt / channel, so "which build is this?" needs no
// cluster access. A filesystem route here wins over next.config.ts's
// `/api/:path*` proxy rewrite (that runs afterFiles), and the locale proxy's
// matcher already excludes `api`, so this answers at the bare path.
export const dynamic = 'force-dynamic';

export async function GET() {
  const versionInfo = getVersionInfo();
  // Use the public configured API explicitly: no internal address enters the
  // response, and an unset public URL never causes a guessed backend request.
  const api = await fetchBackendVersion(versionInfo.backend.apiBaseUrl);
  const response: VersionInfo = {
    ...versionInfo,
    backend: { ...versionInfo.backend, api },
  };
  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

