import { cookies as nextCookies, headers as nextHeaders } from 'next/headers';
import type {IncomingHttpHeaders} from "http";
import {authCookieName, JWT, legacyAuthCookieNames} from "@/utils/config";
import {NextRequest} from "next/server";


/**
 * Read JWT cookie on the server robustly.
 * Priority:
 * 1) next/headers.cookies() if available (App Router server env)
 * 2) Provided `headers` param (WHATWG Headers or Node IncomingHttpHeaders)
 * 3) next/headers() fallback to read raw cookie header
 */
export function getJwtFromRequest(req: NextRequest): string | null {
  // อ่าน cookie โดยตรงจาก NextRequest
  let raw: string | null = null;
  for (const name of [JWT, authCookieName, ...legacyAuthCookieNames]) {
    const value = req.cookies.get(name)?.value;
    if (value) {
      raw = value;
      break;
    }
  }

  if (!raw) return null;

  let token = raw;
  if (token.startsWith("Bearer ")) token = token.slice(7).trim();
  return token || null;
}

export async function getJwtCookieFromServer(
  headers?: Headers | IncomingHttpHeaders | null
): Promise<string | null> {
    // 1) Prefer Next.js cookies()
    try {
        const store = await nextCookies();
        const v = store.get(JWT)?.value;
        if (v) return v;
    } catch {}
    // 2) Provided headers param
    let raw: string | null = null;
    if (headers) {
        if (typeof (headers as any).get === 'function') {
            raw = (headers as Headers).get('cookie');         // WHATWG Headers
        } else {
            raw = (headers as IncomingHttpHeaders).cookie ?? null; // Node headers
        }
    }

    // 3) Fallback: current request headers
    if (!raw) {
        try {
            const h = await nextHeaders();
            raw = h.get('cookie');
        } catch {}
    }

    if (!raw) return null;

    const entries = raw
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((pair) => {
        const [k, ...rest] = pair.split('=');
        const key = decodeURIComponent(k.trim());
        // join back the rest to preserve '=' inside the value
        let val = rest.join('=');
        // Safari can quote cookie values: JWT="eyJ...=="
        if (val?.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1);
        }
        try { val = decodeURIComponent(val); } catch {}
        return [key, val] as const;
      });

    const map = Object.fromEntries(entries) as Record<string, string>;

    // Build a case-insensitive view
    const lowerMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) lowerMap[k.toLowerCase()] = v;

    // Candidate cookie names, in priority order
    const candidates = [
      JWT,
      authCookieName,
      ...legacyAuthCookieNames,
    ].filter(Boolean) as string[];

    let token: string | null = null;
    for (const name of candidates) {
      const direct = map[name];
      const lower = lowerMap[name.toLowerCase()];
      if (direct || lower) {
        token = (direct ?? lower)!;
        break;
      }
    }

    if (!token) return null;
    if (token.startsWith('Bearer ')) token = token.slice(7).trim();
    return token;
}


export async function setForwardedHeaders(reqHeaders: IncomingHttpHeaders): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  if (reqHeaders.host) {
    out["host"] = reqHeaders.host;
  }

  const realIp = reqHeaders["x-real-ip"];
  if (realIp) {
    out["x-real-ip"] = String(realIp);
  }

  const forwardedFor = reqHeaders["x-forwarded-for"];
  if (forwardedFor) {
    out["x-forwarded-for"] = String(forwardedFor);
  }

  const auth = await getJwtCookieFromServer(reqHeaders);
  if (auth) {
    out["authorization"] = `Bearer ${auth}`;
  }

  return out;
}

function safeAtob(b64: string): string {
  if (typeof atob === 'function') return atob(b64);
  // Node.js fallback
  return Buffer.from(b64, 'base64').toString('binary');
}

function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = '==='.slice((b64.length + 3) % 4);
  return safeAtob(b64 + pad);
}

export function parseJwtClaims(token?: string): any {
    if (!token) return {};
    const parts = token.split('.');
    if (parts.length < 2) return {};
    try {
        const json = decodeBase64Url(parts[1]);
        return JSON.parse(json);
    } catch {
        return {};
    }
}


/**
 * A token with no usable `exp` counts as EXPIRED.
 *
 * This used to return false ("ไม่มี exp แปลว่าไม่หมดอายุ" -- no exp means it
 * never expires), which made a hand-written `{"roles":["jobs:admin"]}` payload
 * a session that never ended. Nothing Identity-Platform mints is affected:
 * `exp` is a required, non-optional field on its `AccessTokenClaims`
 * (`crates/auth/src/contract/mod.rs`), so every real token carries one.
 * A non-numeric `exp` is treated the same way -- unusable, therefore expired.
 */
export function isJwtExpired(token?: string): boolean {
    if (!token) return true;
    try {
        const payload = parseJwtClaims(token);
        const exp = payload?.exp;
        if (typeof exp !== "number" || !Number.isFinite(exp)) return true;
        const now = Math.floor(Date.now() / 1000);
        return exp < now;
    } catch {
        return true;
    }
}