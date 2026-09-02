import { NextResponse } from 'next/server';
import { getVersionInfo } from '@/utils/version';

// The readiness surface the k8s probes point at, and the same shape the
// sibling ride web serves (108heros-web PR #23) so one probe path answers for
// both products. It carries the version fields too, because "is it up?" and
// "which build is up?" are the same question during a rollout: a 200 from the
// previous pod is what makes a deploy look finished when it is not.
//
// This lives outside /api on purpose -- next.config.ts rewrites /api/:path*
// to the backend, and a readiness probe must never depend on the backend
// being reachable. The locale proxy's matcher excludes `health` for the same
// reason: a 307 to /th/health/ready is not a probe answer.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { status: 'ok', ...getVersionInfo() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
