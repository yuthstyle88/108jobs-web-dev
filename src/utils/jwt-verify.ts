import {createRemoteJWKSet, jwtVerify, type JWTPayload} from "jose";
import {getIdentityBase} from "@/utils/env";

/**
 * Signature verification for the Identity-Platform access token this app keeps
 * in its auth cookie.
 *
 * Why this module exists: the cookie is set with `document.cookie`
 * (`src/utils/browser.ts`), so it cannot be HttpOnly, so any script -- or
 * anyone typing into a devtools console -- can put an arbitrary string in it.
 * Decoding that string and believing its `roles` claim, which is what
 * `parseJwtClaims` alone amounts to, is not authentication. Only the signature
 * distinguishes a token Identity-Platform minted from one the visitor typed.
 *
 * The tokens are EdDSA (Ed25519) -- see Identity-Platform's
 * `crates/auth/src/contract/mod.rs` (`kty: "OKP"`, `crv: "Ed25519"`) -- and are
 * published at `/.well-known/jwks.json`, the same document api-108heros verifies
 * against in `crates/api/api_utils/src/identity_platform.rs`.
 */

export type JwtVerification =
    /** Signature checked against the published JWKS and every claim we check passed. */
    | {status: "valid"; claims: JWTPayload}
    /** The token is positively bad: bad signature, unknown key, expired, wrong iss/aud. */
    | {status: "invalid"; reason: string}
    /**
     * We could not reach a verdict -- JWKS not configured, or the fetch failed.
     * Deliberately distinct from `invalid`: an Identity-Platform outage must not
     * read as "every session is forged" (see `proxy.ts` for how each is treated).
     */
    | {status: "unavailable"; reason: string};

/**
 * jose error codes that mean "this token is bad", as opposed to "we could not
 * check it". `ERR_JWKS_NO_MATCHING_KEY` belongs here rather than in the
 * unavailable bucket: jose refetches the key set on a `kid` miss before giving
 * up, so surviving that refetch means the key genuinely is not published --
 * which is exactly what a made-up token looks like.
 */
const TOKEN_REJECTED_CODES = new Set([
    "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    "ERR_JWKS_NO_MATCHING_KEY",
    "ERR_JWT_EXPIRED",
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JWT_INVALID",
    "ERR_JWS_INVALID",
    "ERR_JOSE_ALG_NOT_ALLOWED",
    "ERR_JOSE_NOT_SUPPORTED",
]);

/**
 * Where to fetch the signing keys. Defaults to Identity-Platform's well-known
 * path under `NEXT_PUBLIC_IDENTITY_BASE_URL`, which every deployment of this
 * app already sets (without it phone/OTP sign-in does not work at all), so the
 * gate below starts verifying without any new deployment configuration.
 * `IDENTITY_JWKS_URL` overrides it for a deployment that publishes the document
 * somewhere else.
 */
function resolveJwksUrl(): string {
    const explicit = process.env.IDENTITY_JWKS_URL?.trim();
    if (explicit) return explicit;
    const base = getIdentityBase();
    return base ? `${base}/.well-known/jwks.json` : "";
}

/**
 * `iss` and `aud` are checked only when the deployment says what to expect.
 *
 * They are deliberately NOT defaulted. `aud` is per client application in
 * Identity-Platform (`crates/auth/src/domain/client_application.rs` -- each
 * client's own id), so a guessed default would reject every real token and lock
 * the admin area out, trading a phishing surface for an outage. The signature
 * check is what closes the hole and it does not depend on either: nobody can
 * mint a signature for any `iss`/`aud` without the private key.
 */
function expectedIssuer(): string | undefined {
    return process.env.IDENTITY_ISSUER?.trim() || undefined;
}

function expectedAudience(): string | undefined {
    return process.env.IDENTITY_AUDIENCE?.trim() || undefined;
}

let cachedUrl = "";
let cachedKeySet: ReturnType<typeof createRemoteJWKSet> | null = null;

/**
 * One remote key set per URL, kept in module scope so the JWKS document is
 * fetched once and reused across requests rather than on every navigation.
 * jose handles its own caching and rotation refetch behind this handle.
 */
function keySetFor(url: string) {
    if (!cachedKeySet || cachedUrl !== url) {
        cachedKeySet = createRemoteJWKSet(new URL(url));
        cachedUrl = url;
    }
    return cachedKeySet;
}

/** Test seam: drop the cached key set so a test can serve a different JWKS. */
export function resetJwksCache() {
    cachedKeySet = null;
    cachedUrl = "";
}

export async function verifyJwt(token?: string | null): Promise<JwtVerification> {
    if (!token) return {status: "invalid", reason: "no token"};

    const url = resolveJwksUrl();
    if (!url) {
        return {
            status: "unavailable",
            reason: "no JWKS URL: set NEXT_PUBLIC_IDENTITY_BASE_URL or IDENTITY_JWKS_URL",
        };
    }

    let keySet: ReturnType<typeof createRemoteJWKSet>;
    try {
        keySet = keySetFor(url);
    } catch {
        return {status: "unavailable", reason: `malformed JWKS URL: ${url}`};
    }

    try {
        const {payload} = await jwtVerify(token, keySet, {
            algorithms: ["EdDSA"],
            issuer: expectedIssuer(),
            audience: expectedAudience(),
        });
        return {status: "valid", claims: payload};
    } catch (err: unknown) {
        const code = (err as {code?: string} | null)?.code;
        if (code && TOKEN_REJECTED_CODES.has(code)) {
            return {status: "invalid", reason: code};
        }
        // Anything else -- a failed fetch, a JWKS document that will not parse,
        // a DNS error -- is our problem, not the token's.
        return {status: "unavailable", reason: code ?? String(err)};
    }
}

/** True only for a token whose signature verified and that carries `role`. */
export function verifiedHasRole(v: JwtVerification, role: string): boolean {
    if (v.status !== "valid") return false;
    const roles = (v.claims as {roles?: unknown}).roles;
    return Array.isArray(roles) && roles.includes(role);
}
