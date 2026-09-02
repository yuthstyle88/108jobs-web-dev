import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import packageJson from '../../package.json';
import { APP_VERSION, getVersionInfo } from './version';
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
