import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {SignJWT, exportJWK, generateKeyPair} from "jose";
import {proxy} from "./proxy";
import {resetJwksCache} from "@/utils/jwt-verify";
import {JWT} from "@/utils/config";

const IDENTITY_BASE = "http://identity.test";
const ADMIN_ROLE = "jobs:admin";
const ADMIN_PAGE = "http://localhost:3000/th/admin/topup-coins";
const PROFILE_PAGE = "http://localhost:3000/th/profile";

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;

let keys: Keys;

function request(url: string, token?: string) {
    return new NextRequest(url, {
        headers: token === undefined ? undefined : {cookie: `${JWT}=${token}`},
    });
}

/** Exactly the token pasted in the report: two base64 blobs and the letter x. */
function forgedAdminToken() {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    return `${b64({})}.${b64({roles: [ADMIN_ROLE]})}.x`;
}

/**
 * The same forgery with one more field an attacker would obviously add. This is
 * the case that ONLY the signature check catches: the report's literal token
 * omits `exp`, so treating a missing `exp` as expired already turns it away --
 * add an hour and that second line of defence is gone.
 */
function forgedAdminTokenThatHasNotExpired() {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    return `${b64({alg: "EdDSA", kid: "k1"})}.${b64({roles: [ADMIN_ROLE], exp})}.x`;
}

async function mint(roles: string[]) {
    return new SignJWT({roles})
        .setProtectedHeader({alg: "EdDSA", kid: "k1"})
        .setSubject("identity-1")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(keys.privateKey);
}

async function serveJwks() {
    const jwk = await exportJWK(keys.publicKey);
    const doc = {keys: [{...jwk, kid: "k1", alg: "EdDSA", use: "sig"}]};
    vi.stubGlobal("fetch", vi.fn(async () =>
        new Response(JSON.stringify(doc), {
            status: 200,
            headers: {"Content-Type": "application/jwk-set+json"},
        }),
    ));
}

function identityIsDown() {
    vi.stubGlobal("fetch", vi.fn(async () => {
        throw new TypeError("fetch failed");
    }));
}

/** Where a response sends the browser, or null when it lets the request through. */
function redirectPath(res: Response): string | null {
    const location = res.headers.get("location");
    return location ? new URL(location).pathname : null;
}

beforeEach(async () => {
    resetJwksCache();
    process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = IDENTITY_BASE;
    delete process.env.IDENTITY_JWKS_URL;
    delete process.env.IDENTITY_ISSUER;
    delete process.env.IDENTITY_AUDIENCE;
    keys = await generateKeyPair("EdDSA", {crv: "Ed25519", extractable: true});
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("the /admin gate", () => {
    it("does not open for a hand-written cookie claiming jobs:admin", async () => {
        await serveJwks();

        const res = await proxy(request(ADMIN_PAGE, forgedAdminToken()));

        expect(redirectPath(res)).toBe("/th/not-found");
    });

    it("does not open for a hand-written cookie that also sets a future exp", async () => {
        await serveJwks();

        const res = await proxy(request(ADMIN_PAGE, forgedAdminTokenThatHasNotExpired()));

        expect(redirectPath(res)).toBe("/th/not-found");
    });

    it("opens for a token Identity-Platform actually signed", async () => {
        await serveJwks();

        const res = await proxy(request(ADMIN_PAGE, await mint([ADMIN_ROLE])));

        expect(redirectPath(res)).toBeNull();
    });

    it("stays shut for a real session that does not carry the admin role", async () => {
        await serveJwks();

        const res = await proxy(request(ADMIN_PAGE, await mint(["jobs:user"])));

        expect(redirectPath(res)).toBe("/th/not-found");
    });

    it("fails closed while the JWKS cannot be fetched, even for a genuine admin token", async () => {
        const token = await mint([ADMIN_ROLE]);
        identityIsDown();

        const res = await proxy(request(ADMIN_PAGE, token));

        expect(redirectPath(res)).toBe("/th/not-found");
    });

    it("stays shut with no cookie at all", async () => {
        await serveJwks();

        expect(redirectPath(await proxy(request(ADMIN_PAGE)))).toBe("/th/not-found");
    });
});

describe("ordinary protected pages", () => {
    it("bounce a cookie proven forged back to login", async () => {
        await serveJwks();

        const res = await proxy(request(PROFILE_PAGE, forgedAdminToken()));

        expect(redirectPath(res)).toBe("/th/login");
    });

    it("bounce an unexpired forgery back to login too", async () => {
        await serveJwks();

        const res = await proxy(request(PROFILE_PAGE, forgedAdminTokenThatHasNotExpired()));

        expect(redirectPath(res)).toBe("/th/login");
    });

    it("let a real session through", async () => {
        await serveJwks();

        const res = await proxy(request(PROFILE_PAGE, await mint(["jobs:user"])));

        expect(redirectPath(res)).toBeNull();
    });

    it("do NOT sign a real session out while Identity-Platform is unreachable", async () => {
        // The admin area fails closed above; these pages deliberately do not.
        // They render nothing the API has not separately authorized, and an
        // Identity outage must not log the whole userbase out of /chat.
        const token = await mint(["jobs:user"]);
        identityIsDown();

        const res = await proxy(request(PROFILE_PAGE, token));

        expect(redirectPath(res)).toBeNull();
    });
});
