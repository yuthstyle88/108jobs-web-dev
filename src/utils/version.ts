import packageJson from '../../package.json';

// The product number (VERSIONING_STANDARD.md §2). package.json is the ONE place
// it lives; this module only reads it. It moves in a release commit, never in a
// feature PR.
export const APP_VERSION: string = packageJson.version;

export type Channel = 'staging' | 'release' | 'unknown';

export interface VersionInfo {
  version: string;
  appVersion: string;
  build: string;
  builtAt: string;
  channel: Channel;
  backend: {
    apiBaseUrl: string;
    identityBaseUrl: string;
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
export function getVersionInfo(): VersionInfo {
  const build = firstSet(process.env.APP_BUILD, process.env.NEXT_PUBLIC_APP_BUILD);
  const builtAt = firstSet(process.env.APP_BUILT_AT, process.env.NEXT_PUBLIC_APP_BUILT_AT);
  const channel = firstSet(process.env.APP_CHANNEL, process.env.NEXT_PUBLIC_APP_CHANNEL);

  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    build: build === UNKNOWN ? UNKNOWN : normaliseBuild(build),
    builtAt,
    channel: normaliseChannel(channel),
    // The API this bundle talks to (§3: "a web app must not report only its own
    // version"). Its version is not readable yet -- api.108heros.com serves no
    // /health/ready -- so the binding is reported, not a number nobody can get.
    backend: {
      apiBaseUrl: firstSet(process.env.NEXT_PUBLIC_API_BASE_URL, process.env.API_INTERNAL_URL),
      identityBaseUrl: firstSet(process.env.NEXT_PUBLIC_IDENTITY_BASE_URL),
    },
  };
}
