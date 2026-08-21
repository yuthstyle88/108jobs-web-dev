import {NextRequest, NextResponse} from "next/server";
import {getJwtFromRequest} from "@/utils/helper-server";

/**
 * Upstream response headers worth mirroring back to the browser.
 *
 * `x-content-type-options` and `content-disposition` are not cosmetic: the
 * backend sets `nosniff` and picks `inline` only for jpeg/png/webp,
 * `attachment` for everything else (including SVG) specifically so an
 * applicant-supplied SVG can never render inline at this app's own origin --
 * that would be stored XSS against the reviewing admin. Dropping either
 * header here would silently undo that protection, so both are forwarded
 * unconditionally and neither is ever overridden by a caller.
 */
const FORWARDED_RESPONSE_HEADERS = [
    "content-type",
    "content-length",
    "x-content-type-options",
    "content-disposition",
] as const;

/**
 * Forward the caller's session token to one upstream URL and stream the reply.
 *
 * The backend's `read_auth_token` accepts only an `Authorization: Bearer`
 * header or a cookie literally named `jwt`. This app's auth cookie is named
 * after `NEXT_PUBLIC_APP_NAME`, so a plain `<img src>` pointed straight at
 * the backend sends neither and is always 401. This reads the token
 * server-side and forwards it as a bearer, so the browser only ever needs a
 * same-origin `<img>` src.
 *
 * `upstreamUrl` is built by the CALLER from values it has already validated.
 * This helper never takes a URL, a path fragment or a host from the request
 * -- it forwards a token, it does not choose a target. Handing it anything
 * derived from `req` would turn every caller into an open proxy.
 *
 * No `Range` handling in either direction. A caller whose upstream resource
 * can be sought (streamed video, for example) should not route through this
 * helper -- see `src/app/api/media/[assetId]/route.ts`, which forwards Range
 * itself rather than growing this helper's contract to carry it.
 */
export async function forwardAuthedUpstream(
    req: NextRequest,
    upstreamUrl: string,
): Promise<NextResponse> {
    const token = getJwtFromRequest(req);
    if (!token) {
        return NextResponse.json({error: "unauthorized"}, {status: 401});
    }

    let upstream: Response;
    try {
        upstream = await fetch(upstreamUrl, {
            headers: {Authorization: `Bearer ${token}`},
            // The backend's per-resource authorization check must run on
            // every read -- never serve a cached response for a check it
            // did not just re-run.
            cache: "no-store",
        });
    } catch {
        return NextResponse.json({error: "upstream_unreachable"}, {status: 502});
    }

    const headers = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value !== null) headers.set(name, value);
    }
    // Never let a shared or browser cache outlive the backend's own
    // authorization check -- overrides whatever Cache-Control (if any) the
    // upstream response carried.
    headers.set("Cache-Control", "private, no-store");

    return new NextResponse(upstream.body, {status: upstream.status, headers});
}
