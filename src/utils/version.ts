import packageJson from '../../package.json';

// The product number (VERSIONING_STANDARD.md §2). package.json is the ONE place
// it lives; this module only reads it. It moves in a release commit, never in a
// feature PR.
export const APP_VERSION: string = packageJson.version;

export type Channel = 'staging' | 'release' | 'unknown';

export interface BackendVersion {
  version: string;
  build: string;
  builtAt: string;
  channel: Channel;
}

export interface VersionInfo {
  version: string;
  appVersion: string;
  build: string;
  builtAt: string;
  channel: Channel;
  backend: {
    apiBaseUrl: string;
    identityBaseUrl: string;
    api: BackendVersion | null;
  };
}

// Every value below that is not known is reported as the literal "unknown",
// never invented. A field that is missing says "I don't know"; a field that
// is made up says "I know, and here is the wrong answer" -- and nobody checks
// an answer that looks given. 108heros-web#18 shipped a hard-coded builtAt and
// a channel guessed from NODE_ENV (which is `production` on BOTH lanes, so
// staging reported itself as release). Neither is repeated here.
const UNKNOWN = 'unknown';

function firstSet(...values: Array<string | undefined>): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return UNKNOWN;
}

// `build` must equal the image tag helm deployed -- `sha-<7>` -- so a person
// reading /api/version and a person reading `kubectl get pod` see the same
// string. Accept a bare or `sha-` prefixed full sha and shorten it; leave
// anything else alone.
function normaliseBuild(raw: string): string {
  const m = /^(?:sha-)?([0-9a-f]{7,40})$/i.exec(raw);
  return m ? `sha-${m[1].slice(0, 7).toLowerCase()}` : raw;
}

function normaliseChannel(raw: string): Channel {
  return raw === 'staging' || raw === 'release' ? raw : UNKNOWN;
}

// Read at request time (the route is force-dynamic), so the values are the
// running container's env: APP_* are set by the runner stage of the Dockerfile
// from build-args, and APP_CHANNEL is also set per lane by helm
// (`--set config.APP_CHANNEL=...`), which wins over the image's own value.
// Preserve the synchronous local payload used by /health/ready and existing
// callers. Only /api/version enriches it with the remote API identity.
export type LocalVersionInfo = Omit<VersionInfo, 'backend'> & {
  backend: Omit<VersionInfo['backend'], 'api'>;
};

export function getVersionInfo(): LocalVersionInfo {
  const build = firstSet(process.env.APP_BUILD, process.env.NEXT_PUBLIC_APP_BUILD);
  const builtAt = firstSet(process.env.APP_BUILT_AT, process.env.NEXT_PUBLIC_APP_BUILT_AT);
  const channel = firstSet(process.env.APP_CHANNEL, process.env.NEXT_PUBLIC_APP_CHANNEL);

  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    build: build === UNKNOWN ? UNKNOWN : normaliseBuild(build),
    builtAt,
    channel: normaliseChannel(channel),
    // The backend this bundle is pointed at. ONLY the public names are read,
    // and only the names this repo actually sets: NEXT_PUBLIC_API_BASE_URL and
    // NEXT_PUBLIC_IDENTITY_BASE_URL (Dockerfile:16,23, .env.example, and
    // next.config.ts's CSP). Unset reads "unknown", which is the honest answer.
    //
    // API_INTERNAL_URL is documented as server-only (src/utils/env.ts:5) and
    // this route is unauthenticated (src/app/api/version/route.ts), so
    // falling through to it publishes whatever cluster-internal address that
    // variable holds. Benign only while the Dockerfile happens to set it to
    // the same public host; it stops being benign the moment anyone uses the
    // variable for what its name says.
    //
    // The remote API version is queried separately via /api/v4/site/health
    // by /api/version at request time; /health/ready serves only this local
    // portion to avoid depending on external network availability.
    backend: {
      apiBaseUrl: firstSet(process.env.NEXT_PUBLIC_API_BASE_URL),
      identityBaseUrl: firstSet(process.env.NEXT_PUBLIC_IDENTITY_BASE_URL),
    },
  };
}

/** Read the configured public API; unknown/unavailable identity stays null. */
export async function fetchBackendVersion(baseUrl: string): Promise<BackendVersion | null> {
  if (!baseUrl.trim() || baseUrl === UNKNOWN) return null;
  try {
    const base = new URL(baseUrl);
    if (base.protocol !== 'http:' && base.protocol !== 'https:') return null;
    const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/v4/site/health`, {
      // Diagnostics must remain responsive when the API is down. Two seconds
      // bounds this optional lookup, including response-body consumption.
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    });
    if (response.status !== 200) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('version' in data)
      || typeof data.version !== 'string' || !data.version.trim()) return null;
    const identity = data as Record<string, unknown>;
    return {
      version: data.version.trim(),
      build: typeof identity.build === 'string' ? firstSet(identity.build) : UNKNOWN,
      // HealthResponse serializes camelCase; Rust's built_at is not the wire key.
      builtAt: typeof identity.builtAt === 'string' ? firstSet(identity.builtAt) : UNKNOWN,
      channel: normaliseChannel(typeof identity.channel === 'string' ? identity.channel : UNKNOWN),
    };
  } catch {
    return null;
  }
}
