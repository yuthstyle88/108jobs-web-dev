import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {SignJWT, exportJWK, generateKeyPair} from "jose";
import {resetJwksCache, verifiedHasRole, verifyJwt} from "./jwt-verify";

const IDENTITY_BASE = "http://identity.test";
const JWKS_URL = `${IDENTITY_BASE}/.well-known/jwks.json`;
const ADMIN_ROLE = "jobs:admin";

type Keys = Awaited<ReturnType<typeof generateKeyPair>>;

async function ed25519Keys(): Promise<Keys> {
    return generateKeyPair("EdDSA", {crv: "Ed25519", extractable: true});
}

/** The JWKS document Identity-Platform publishes for a key: OKP / Ed25519. */
async function jwksFor(keys: Keys, kid: string) {
    const jwk = await exportJWK(keys.publicKey);
    return {keys: [{...jwk, kid, alg: "EdDSA", use: "sig"}]};
}

function serveJwks(doc: unknown) {
    const fetchMock = vi.fn(async (input: unknown) => {
        expect(String(input)).toBe(JWKS_URL);
        return new Response(JSON.stringify(doc), {
            status: 200,
            headers: {"Content-Type": "application/jwk-set+json"},
        });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

async function mintToken(keys: Keys, kid: string, claims: Record<string, unknown> = {}) {
    return new SignJWT({roles: [ADMIN_ROLE], ...claims})
        .setProtectedHeader({alg: "EdDSA", kid})
        .setSubject("identity-1")
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(keys.privateKey);
}

beforeEach(() => {
    resetJwksCache();
    process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = IDENTITY_BASE;
    delete process.env.IDENTITY_JWKS_URL;
    delete process.env.IDENTITY_ISSUER;
    delete process.env.IDENTITY_AUDIENCE;
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("verifyJwt", () => {
    it("accepts a token signed by the key the JWKS publishes", async () => {
        const keys = await ed25519Keys();
        serveJwks(await jwksFor(keys, "k1"));

        const result = await verifyJwt(await mintToken(keys, "k1"));

        expect(result.status).toBe("valid");
        expect(verifiedHasRole(result, ADMIN_ROLE)).toBe(true);
    });

    it("rejects the hand-made token from the report -- two base64 blobs and the letter x", async () => {
        const keys = await ed25519Keys();
        serveJwks(await jwksFor(keys, "k1"));

        const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
        const forged = `${b64({})}.${b64({roles: [ADMIN_ROLE]})}.x`;

        const result = await verifyJwt(forged);

        expect(result.status).toBe("invalid");
        expect(verifiedHasRole(result, ADMIN_ROLE)).toBe(false);
    });

    it("rejects a real, well-formed token signed by a key that is not published", async () => {
        const published = await ed25519Keys();
        const attacker = await ed25519Keys();
        serveJwks(await jwksFor(published, "k1"));

        // Same `kid` as the published key, so the lookup succeeds and only the
        // signature check can catch it.
        const result = await verifyJwt(await mintToken(attacker, "k1"));

        expect(result.status).toBe("invalid");
        expect(verifiedHasRole(result, ADMIN_ROLE)).toBe(false);
    });

    it("rejects an expired token even though it is correctly signed", async () => {
        const keys = await ed25519Keys();
        serveJwks(await jwksFor(keys, "k1"));

        const expired = await new SignJWT({roles: [ADMIN_ROLE]})
            .setProtectedHeader({alg: "EdDSA", kid: "k1"})
            .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
            .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
            .sign(keys.privateKey);

        expect((await verifyJwt(expired)).status).toBe("invalid");
    });

    it("rejects a token whose issuer is not the configured one", async () => {
        const keys = await ed25519Keys();
        serveJwks(await jwksFor(keys, "k1"));
        process.env.IDENTITY_ISSUER = "auth-service";

        const wrongIssuer = await mintToken(keys, "k1", {iss: "somewhere-else"});

        expect((await verifyJwt(wrongIssuer)).status).toBe("invalid");
    });

    it("ignores iss and aud when the deployment has not said what to expect", async () => {
        const keys = await ed25519Keys();
        serveJwks(await jwksFor(keys, "k1"));

        // A real token carries whatever `aud` its client application was
        // registered with; guessing one would reject every genuine session.
        const token = await mintToken(keys, "k1", {iss: "auth-service", aud: "some-client-id"});

        expect((await verifyJwt(token)).status).toBe("valid");
    });

    it("reports unavailable -- not invalid -- when the JWKS cannot be fetched", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => {
            throw new TypeError("fetch failed");
        }));
        const keys = await ed25519Keys();

        const result = await verifyJwt(await mintToken(keys, "k1"));

        expect(result.status).toBe("unavailable");
    });

    it("reports unavailable when no Identity base URL is configured", async () => {
        delete process.env.NEXT_PUBLIC_IDENTITY_BASE_URL;
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const result = await verifyJwt("anything.at.all");

        expect(result.status).toBe("unavailable");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("prefers IDENTITY_JWKS_URL over the Identity base URL", async () => {
        const keys = await ed25519Keys();
        process.env.IDENTITY_JWKS_URL = JWKS_URL;
        process.env.NEXT_PUBLIC_IDENTITY_BASE_URL = "http://ignored.test";
        serveJwks(await jwksFor(keys, "k1"));

        expect((await verifyJwt(await mintToken(keys, "k1"))).status).toBe("valid");
    });

    it("treats a missing token as invalid without reaching for the network", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        expect((await verifyJwt("")).status).toBe("invalid");
        expect((await verifyJwt(null)).status).toBe("invalid");
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
