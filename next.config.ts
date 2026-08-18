import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Produce a minimal, self-contained output for faster cold starts
    // Fail fast in production; allow flexibility in dev/CI if desired
    // Next.js 16: 'eslint' in next.config is no longer supported; manage ESLint via .eslintrc and CLI
    // Continue to ignore TypeScript build errors in non-prod to ease local dev/CI
    // Provide an explicit (empty) Turbopack config to avoid conflicts with custom webpack config
    turbopack: {},
    reactCompiler: true,
    reactStrictMode: true,
    poweredByHeader: false,
    compress: true,
    // Reduce client bundle size and improve runtime perf
    // Prefer modern optimizations
    // Next.js 16: use SWC-based modularizeImports for reliable per-module transforms
    modularizeImports: {
        lodash: {
            transform: 'lodash/{{member}}',
            preventFullImport: true,
        },
        // Note: lucide-react, react-icons, and Radix UI packages are generally ESM-friendly.
        // We rely on their tree-shaking and direct subpath imports in code.
    },
    // experimental: {
    //     turbopackFileSystemCacheForDev: true,
    // },
    compiler: {
        // Trim console.* in production bundles but keep error/warn
        removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },
    typescript: {
        ignoreBuildErrors: process.env.NODE_ENV !== 'production',
    },

    // 108jobs-client ships prebuilt CommonJS (tsc output, requiring @tsoa/runtime at module
    // eval time), not raw ESM/TS source -- transpilePackages forces it through Turbopack's
    // ESM transform pipeline, which drops the CJS interop shim and leaves bare require()
    // calls in the RSC/SSR bundle where no `require` global exists ("require is not defined"
    // crashing every server-rendered page that imports it, e.g. /profile/[username]).
    // serverExternalPackages instead leaves it as a real external CJS dependency resolved by
    // Node's native require() at runtime, which is what its prebuilt output actually needs.
    serverExternalPackages: ['108jobs-client'],

    images: {
        // Using Next/Image without on-the-fly optimization to keep server lean
        // Flip to `false` if you want Next's built-in Image Optimization.
        unoptimized: true,
    },

    // Smaller bundles and faster builds in production
    productionBrowserSourceMaps: false,

    // Security + cache headers
    // Ensure WebAssembly works reliably in all environments (avoid fetch failures)
    webpack: (config: any) => {
        // Enable modern WebAssembly support in Webpack
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
            topLevelAwait: true,
            layers: true,
        };

        // Some environments block or mis-serve .wasm via fetch(). To make the app resilient,
        // emit WASM as a real file so libraries that do `fetch(url)` can load it
        const rules = (config.module?.rules ?? []) as any[];
        const hasWasmRule = rules.some((r: any) => String(r.test) === String(/\.wasm$/));
        if (!hasWasmRule) {
            (config.module ??= { rules: [] as any[] }).rules!.push({
                test: /\.wasm$/,
                type: 'asset/resource',
                generator: {
                    filename: 'static/wasm/[name]-[hash][ext]',
                },
            });
        }

        return config;
    },

    async redirects() {

        // Adjust the path list below to match the sections you want to protect
        return [
            {
                source: '/dashboard/:path*',
                destination: '/login',
                permanent: false,
                missing: [
                    {type: 'cookie', key: 'jwt'},
                    {type: 'cookie', key: 'access_token'},
                    {type: 'cookie', key: 'token'},
                    {type: 'header', key: 'authorization'},
                ],
            },
            {
                source: '/account/:path*',
                destination: '/login',
                permanent: false,
                missing: [
                    {type: 'cookie', key: 'jwt'},
                    {type: 'header', key: 'authorization'},
                ],
            },
            {
                source: '/settings/:path*',
                destination: '/login',
                permanent: false,
                missing: [
                    {type: 'cookie', key: 'jwt'},
                    {type: 'cookie', key: 'access_token'},
                    {type: 'cookie', key: 'token'},
                    {type: 'header', key: 'authorization'},
                ],
            },
        ];
    },

    // Long-term caching for static assets and wasm files.
    // The immutable directive on /_next/static/* is production-only: it assumes
    // content-hashed filenames that never change without a new hash, which holds
    // for a production build but not for Turbopack's dev-mode chunk URLs (those
    // don't reliably get new names on every rebuild). Applying it in dev let
    // browsers cache a stale JS chunk under an "immutable" contract and never
    // re-fetch it across page reloads or dev-server restarts, silently serving
    // old code while the source and compiled output were both already correct.
    async headers() {
        // Same-origin browser API calls only ever hit our own /api/* routes; the
        // one cross-origin exception is direct calls to NEXT_PUBLIC_API_BASE_URL
        // made by the generated 108jobs-client (login, register, refresh handoff,
        // etc.), so connect-src has to allow that origin explicitly.
        const apiOrigin = (() => {
            try {
                return new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? '').origin;
            } catch {
                return '';
            }
        })();
        // buildActixWsUrl() (chatSocketUtils.ts) opens the chat WebSocket against
        // this same host/port, just over ws:/wss: instead of http:/https: -- a
        // CSP source with an http(s) scheme does NOT also permit a ws(s)
        // connection to the same origin, so without this the browser blocks the
        // socket with "violates ... connect-src" even though the API origin
        // itself is already allowed.
        const apiWsOrigin = apiOrigin.replace(/^http/, 'ws');
        // Phone/OTP register+login (IdentityOtpService.ts) calls Identity-Platform
        // directly from the browser -- same reason as apiOrigin above, different
        // origin, no ws: equivalent needed since it's plain request/response.
        const identityOrigin = (() => {
            try {
                return new URL(process.env.NEXT_PUBLIC_IDENTITY_BASE_URL ?? '').origin;
            } catch {
                return '';
            }
        })();
        // uploadToMad (madUpload.ts) runs MAD's three-call upload handshake
        // (open session / PUT bytes / complete) as plain fetch()es straight from
        // the browser to the media gateway -- same cross-origin exception as
        // apiOrigin/identityOrigin above, and easy to miss because without it the
        // failure looks identical to a network-layer problem: the browser blocks
        // the connection before it ever reaches the wire, so no request appears in
        // the gateway's logs, and the error surfaced to JS is the generic
        // `TypeError: Failed to fetch` either way. NEXT_PUBLIC_MEDIA_PUBLIC_URL is
        // usually the same host as the gateway but is allowed to differ (e.g. a
        // CDN in front of it), so both are added.
        const mediaGatewayOrigin = (() => {
            try {
                return new URL(process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL ?? '').origin;
            } catch {
                return '';
            }
        })();
        const mediaPublicOrigin = (() => {
            try {
                return new URL(process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL ?? '').origin;
            } catch {
                return '';
            }
        })();
        // Next.js dev mode (Fast Refresh / React's dev-only debugging) uses
        // eval() to reconstruct call stacks -- blocked without 'unsafe-eval',
        // which breaks every page in dev (confirmed: React itself states it
        // "will never use eval() in production mode"), so this is dev-only.
        const scriptSrc = process.env.NODE_ENV === 'production'
            ? "script-src 'self' 'unsafe-inline'"
            : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
        const csp = [
            "default-src 'self'",
            scriptSrc,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://cdn.108jobs.com",
            "font-src 'self' data:",
            `connect-src ${[...new Set(["'self'", apiOrigin, apiWsOrigin, identityOrigin, mediaGatewayOrigin, mediaPublicOrigin].filter(Boolean))].join(' ')}`,
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join('; ');

        return [
            ...(process.env.NODE_ENV === 'production' ? [{
                source: '/_next/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            }] : []),
            {
                source: '/static/wasm/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                    { key: 'Content-Type', value: 'application/wasm' },
                ],
            },
            {
                source: '/(.*)',
                headers: [
                    { key: 'Content-Security-Policy', value: csp },
                    // Belt-and-suspenders for the same dev-mode staleness this file
                    // already documents above: page/RSC responses aren't
                    // content-hashed the way /_next/static/* is, so there's no URL
                    // change to force a re-fetch after a rebuild. Production relies
                    // on Next's own (short) default page caching instead -- this is
                    // dev-only so it never affects real cache behavior.
                    ...(process.env.NODE_ENV === 'production' ? [] : [
                        { key: 'Cache-Control', value: 'no-store' },
                    ]),
                ],
            },
        ];
    },
    // Rewrites to backend/CDN (replace env as needed)
    async rewrites() {
        // Fail closed: an unset API_INTERNAL_URL in production must not silently
        // route real traffic to the staging backend.
        if (!process.env.API_INTERNAL_URL && process.env.NODE_ENV === 'production') {
            throw new Error('API_INTERNAL_URL must be set in production (refusing to fall back to the staging backend)');
        }
        const apiBase = process.env.API_INTERNAL_URL ?? 'https://api-staging.108jobs.com';
        return {
            // Ensure these filesystem routes win before any proxying
            beforeFiles: [
                { source: '/session', destination: '/api/session' },
                { source: '/:lang(th|en|vi)/session', destination: '/api/session' },
                { source: '/api/session', destination: '/api/session' },
                { source: '/api/auth/session', destination: '/api/auth/session' },
                { source: '/api/auth/refresh', destination: '/api/auth/refresh' },
            ],
            // Proxy other API routes and static uploads
            afterFiles: [
                { source: '/api/:path*', destination: `${apiBase}/:path*` },
                { source: '/uploads/:path*', destination: 'https://cdn.108jobs.com/uploads/:path*' },
            ],
            fallback: [],
        };
    },

};

export default nextConfig;