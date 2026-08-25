import {NextRequest, NextResponse} from "next/server";
import {getJwtFromRequest} from "@/utils/helper-server";
import {getApiBase} from "@/utils/env";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Upstream response headers worth mirroring back to the browser. `Range` /
 * `Content-Range` / `Accept-Ranges` are what let `<video>` seek -- without
 * them a browser can only ever request the whole file, and Safari refuses to
 * play video at all without a working `206` response.
 */
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-length", "content-range", "accept-ranges"] as const;

/**
 * Same-origin byte proxy for private chat media.
 *
 * The backend's `read_auth_token` accepts only an `Authorization: Bearer`
 * header or a cookie literally named `jwt`. This app's auth cookie is named
 * after `NEXT_PUBLIC_APP_NAME` (`108Heros`), so a plain `<img src>` pointed
 * straight at the backend's `media-proxy` sends neither and is always `401`
 * -- confirmed against a real browser request. This route reads the token
 * server-side, where `getJwtFromRequest` already checks both cookie names,
 * and forwards it as a bearer, so the browser only ever needs a same-origin
 * `<img>`/`<video>` src.
 *
 * `assetId` is validated as a UUID and never used to build anything but the
 * one hard-coded backend URL below -- this proxies exactly one endpoint, on
 * exactly one host, and never redirects the browser to MAD or exposes a MAD
 * URL. The backend's room-membership check stays the sole authority over
 * whether the bytes may be read; this route only ever forwards that
 * decision, never caches past it.
 */
export async function GET(
  req: NextRequest,
  {params}: {params: Promise<{assetId: string}>},
) {
  const {assetId} = await params;

  const token = getJwtFromRequest(req);
  if (!token) {
    return NextResponse.json({error: "unauthorized"}, {status: 401});
  }

  if (!UUID_PATTERN.test(assetId)) {
    return NextResponse.json({error: "invalid_asset_id"}, {status: 400});
  }

  const upstreamHeaders: Record<string, string> = {Authorization: `Bearer ${token}`};
  const range = req.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(`${getApiBase()}/api/v4/media-proxy/${assetId}`, {
      headers: upstreamHeaders,
      // The backend's room-membership check must run on every single read --
      // this route (and the fetch it makes) must never serve a cached
      // response for a check it did not just re-run.
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
