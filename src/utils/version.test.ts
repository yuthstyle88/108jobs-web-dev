import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json';
import { APP_VERSION, fetchBackendVersion, getVersionInfo } from './version';
import { GET as getVersionRoute } from '@/app/api/version/route';
import { GET as getReadyRoute } from '@/app/health/ready/route';

const VERSION_ENV = [
  'APP_BUILD',
  'NEXT_PUBLIC_APP_BUILD',
  'APP_BUILT_AT',
  'NEXT_PUBLIC_APP_BUILT_AT',
  'APP_CHANNEL',
  'NEXT_PUBLIC_APP_CHANNEL',
] as const;

describe('versioning standard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of VERSION_ENV) delete process.env[key];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  it('reads the number from package.json and pins MAJOR at 1 (§2)', () => {
    expect(APP_VERSION).toBe(packageJson.version);
    expect(APP_VERSION).toMatch(/^1\.\d+\.\d+$/);
  });

  it('reports "unknown", not an invented value, when nothing set build/builtAt/channel', () => {
    const info = getVersionInfo();
    expect(info.version).toBe(packageJson.version);
    expect(info.appVersion).toBe(packageJson.version);
    expect(info.build).toBe('unknown');
    expect(info.builtAt).toBe('unknown');
    expect(info.channel).toBe('unknown');
  });

  it('reports the configured build, builtAt and channel', () => {
    process.env.APP_BUILD = 'sha-1234567';
    process.env.APP_BUILT_AT = '2026-09-02T05:31:00Z';
    process.env.APP_CHANNEL = 'release';

    const info = getVersionInfo();
    expect(info.build).toBe('sha-1234567');
    expect(info.builtAt).toBe('2026-09-02T05:31:00Z');
    expect(info.channel).toBe('release');
  });

  it('shortens a full sha to the sha-<7> the image tag uses', () => {
    process.env.APP_BUILD = 'sha-fbbbc99a0b1c2d3e4f5061728394a5b6c7d8e9f0';
    expect(getVersionInfo().build).toBe('sha-fbbbc99');

    process.env.APP_BUILD = 'FBBBC99A0B1C2D3E4F5061728394A5B6C7D8E9F0';
    expect(getVersionInfo().build).toBe('sha-fbbbc99');
  });

  it('does not guess the lane from NODE_ENV or accept a channel outside the two lanes', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getVersionInfo().channel).toBe('unknown');

    process.env.APP_CHANNEL = 'prod';
    expect(getVersionInfo().channel).toBe('unknown');

    process.env.APP_CHANNEL = 'staging';
    expect(getVersionInfo().channel).toBe('staging');
  });

  it('GET /api/version answers 200 JSON whose version is the manifest version', async () => {
    process.env.APP_BUILD = 'sha-1234567';
    process.env.APP_BUILT_AT = '2026-09-02T05:31:00Z';
    process.env.APP_CHANNEL = 'staging';

    const res = await getVersionRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json).toMatchObject({
      version: packageJson.version,
      appVersion: packageJson.version,
      build: 'sha-1234567',
      builtAt: '2026-09-02T05:31:00Z',
      channel: 'staging',
    });
    expect(typeof json.backend?.apiBaseUrl).toBe('string');
  });

  it('GET /health/ready answers 200 with status ok and the same version fields', async () => {
    process.env.APP_BUILD = 'sha-1234567';
    process.env.APP_BUILT_AT = '2026-09-02T05:31:00Z';
    process.env.APP_CHANNEL = 'release';

    const res = await getReadyRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json).toMatchObject({
      version: packageJson.version,
      build: 'sha-1234567',
      channel: 'release',
    });
  });

  it('never publishes API_INTERNAL_URL, the server-only address (108heros-web#28)', () => {
    process.env.API_INTERNAL_URL = 'http://jobs-api.prod.svc.cluster.local:8536';
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_IDENTITY_BASE_URL;

    const info = getVersionInfo();
    expect(info.backend.apiBaseUrl).toBe('unknown');
    expect(JSON.stringify(info)).not.toContain('cluster.local');
  });

  it('reports the public backend names the image actually sets', () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://api.108heros.com';
    process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = 'https://identity.108plaza.net';

    expect(getVersionInfo().backend).toEqual({
      apiBaseUrl: 'https://api.108heros.com',
      identityBaseUrl: 'https://identity.108plaza.net',
    });
  });
});

describe('backend API version (#169)', () => {
  const fetchMock = vi.fn();
  const identity = {
    success: true,
    version: '1.0.0-alpha.5',
    appVersion: '1.0.0-alpha.5',
    build: 'sha-d06ab00',
    builtAt: '2026-09-05T07:25:05Z',
    channel: 'release' as const,
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.test');
    vi.stubEnv('NEXT_PUBLIC_IDENTITY_BASE_URL', 'https://identity.example.test');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reports the backend api version when the health endpoint answers (criterion 2)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(identity)));
    const response = await getVersionRoute();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.backend.api).toEqual({
      version: identity.version,
      build: identity.build,
      builtAt: identity.builtAt,
      channel: identity.channel,
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/api/v4/site/health', {
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
  });

  it.each(['network', '500', 'missing version', 'invalid JSON', 'null', 'blank version'])(
    'keeps the route available when backend returns %s (criterion 3 & edge cases)',
    async (failure) => {
      if (failure === 'network') {
        fetchMock.mockRejectedValue(new Error('offline'));
      } else {
        fetchMock.mockResolvedValue(
          new Response(
            failure === 'invalid JSON'
              ? '{'
              : JSON.stringify(
                  failure === 'null'
                    ? null
                    : failure === 'blank version'
                      ? { version: ' ' }
                      : {},
                ),
            { status: failure === '500' ? 500 : 200 },
          ),
        );
      }
      const local = getVersionInfo();
      const response = await getVersionRoute();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ...local,
        backend: { ...local.backend, api: null },
      });
    },
  );

  it('bounds the optional fetch with a two-second timeout (criterion 4)', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    try {
      fetchMock.mockImplementation(
        (_url, options) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('timeout')), {
              once: true,
            });
          }),
      );
      const pending = getVersionRoute();
      controller.abort();
      const response = await pending;
      expect(response.status).toBe(200);
      expect((await response.json()).backend.api).toBeNull();
      expect(timeout).toHaveBeenCalledWith(2000);
    } finally {
      timeout.mockRestore();
    }
  });

  it.each(['unknown', '', 'not a URL', 'file:///tmp/test', 'javascript:alert(1)'])(
    'does not fetch an unavailable or invalid API base: %s (criterion 5 & edge cases)',
    async (base) => {
      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      if (base !== 'unknown') {
        vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', base);
      }
      const res = await fetchBackendVersion(base);
      expect(res).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('never publishes the internal cluster address from the version route (criterion 6)', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://internal-cluster.local:8523');
    fetchMock.mockResolvedValue(new Response(JSON.stringify(identity)));
    const response = await getVersionRoute();
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('internal-cluster.local');
    expect(body.backend.apiBaseUrl).toBe('https://api.example.test');
    expect(body.backend.identityBaseUrl).toBe('https://identity.example.test');
  });

  it('preserves all original fields in the response shape (criterion 7)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(identity)));
    const response = await getVersionRoute();
    const json = await response.json();
    expect(json).toHaveProperty('version');
    expect(json).toHaveProperty('appVersion');
    expect(json).toHaveProperty('build');
    expect(json).toHaveProperty('builtAt');
    expect(json).toHaveProperty('channel');
    expect(json).toHaveProperty('backend');
    expect(json.backend).toHaveProperty('apiBaseUrl');
    expect(json.backend).toHaveProperty('identityBaseUrl');
  });

  it('normalises unknown channels and reads camelCase builtAt', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ...identity,
          channel: 'production',
          built_at: 'wrong',
        }),
      ),
    );
    expect(await fetchBackendVersion('https://api.example.test/')).toEqual({
      version: identity.version,
      build: identity.build,
      builtAt: identity.builtAt,
      channel: 'unknown',
    });
  });
});

