// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {
    enrollPasskey,
    isPasskeySupported,
    loginWithPasskey,
    rememberedPasskeyIdentifier,
} from "./IdentityPasskeyService";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: {"Content-Type": "application/json"},
        ...init,
    });
}

// jsdom doesn't implement WebAuthn -- stub just enough of the shape this
// service actually touches (PublicKeyCredential's two static JSON parsers,
// navigator.credentials.create/get, and the returned credential's toJSON()).
function stubWebAuthn(opts: {
    createResult?: unknown;
    getResult?: unknown;
    createImpl?: () => Promise<unknown>;
    getImpl?: () => Promise<unknown>;
} = {}) {
    const parseCreationOptionsFromJSON = vi.fn((json: unknown) => ({__parsedCreate: json}));
    const parseRequestOptionsFromJSON = vi.fn((json: unknown) => ({__parsedGet: json}));
    vi.stubGlobal("PublicKeyCredential", {parseCreationOptionsFromJSON, parseRequestOptionsFromJSON});

    const create = opts.createImpl ?? vi.fn().mockResolvedValue(
        opts.createResult === undefined ? {toJSON: () => ({fake: "registration-credential"})} : opts.createResult,
    );
    const get = opts.getImpl ?? vi.fn().mockResolvedValue(
        opts.getResult === undefined ? {toJSON: () => ({fake: "assertion-credential"})} : opts.getResult,
    );
    vi.stubGlobal("navigator", {credentials: {create, get}});

    return {parseCreationOptionsFromJSON, parseRequestOptionsFromJSON, create, get};
}

describe("isPasskeySupported", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("is false when PublicKeyCredential is absent", () => {
        expect(isPasskeySupported()).toBe(false);
    });

    it("is true once the JSON-parsing statics exist", () => {
        stubWebAuthn();
        expect(isPasskeySupported()).toBe(true);
    });

    it("is false if the statics exist but aren't functions (older browser shim)", () => {
        vi.stubGlobal("PublicKeyCredential", {});
        expect(isPasskeySupported()).toBe(false);
    });
});

describe("rememberedPasskeyIdentifier", () => {
    afterEach(() => window.localStorage.clear());

    it("is null when nothing has been remembered", () => {
        expect(rememberedPasskeyIdentifier()).toBeNull();
    });
});

describe("enrollPasskey / loginWithPasskey", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_IDENTITY_BASE_URL", "http://localhost:8090");
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it("does nothing (returns false) when the browser doesn't support passkeys", async () => {
        // No stubWebAuthn() call -- PublicKeyCredential stays absent.
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const ok = await enrollPasskey("identity-1", "at-1", "+66812345678");

        expect(ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("enrollPasskey unwraps the double-wrapped challenge, completes the ceremony, and remembers the identifier", async () => {
        const {parseCreationOptionsFromJSON, create} = stubWebAuthn();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({publicKey: {publicKey: {challenge: "c", rp: {id: "localhost"}}}}))
            .mockResolvedValueOnce(jsonResponse({credentialId: "cred-1"}));
        vi.stubGlobal("fetch", fetchMock);
        // stubWebAuthn() replaced the whole `navigator` global -- fetch above still applies globally.

        const ok = await enrollPasskey("identity-1", "at-1", "+66812345678");

        expect(ok).toBe(true);
        // The parser must receive the INNER object, not the {publicKey: {...}} envelope.
        expect(parseCreationOptionsFromJSON).toHaveBeenCalledWith({challenge: "c", rp: {id: "localhost"}});
        expect(create).toHaveBeenCalledTimes(1);

        expect(fetchMock).toHaveBeenNthCalledWith(1, "http://localhost:8090/auth/passkey/register/challenge",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({authorization: "Bearer at-1"}),
                body: JSON.stringify({identityId: "identity-1"}),
            }));
        expect(fetchMock).toHaveBeenNthCalledWith(2, "http://localhost:8090/auth/passkey/register/verify",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({identityId: "identity-1", credential: {fake: "registration-credential"}}),
            }));

        expect(rememberedPasskeyIdentifier()).toBe("+66812345678");
    });

    it("enrollPasskey returns false without throwing when the user dismisses the OS prompt", async () => {
        stubWebAuthn({createImpl: () => Promise.reject(new DOMException("cancelled", "NotAllowedError"))});
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            jsonResponse({publicKey: {publicKey: {challenge: "c"}}}),
        ));

        const ok = await enrollPasskey("identity-1", "at-1", "+66812345678");

        expect(ok).toBe(false);
        expect(rememberedPasskeyIdentifier()).toBeNull();
    });

    it("loginWithPasskey unwraps the challenge, completes the ceremony, and maps the login response", async () => {
        const {parseRequestOptionsFromJSON, get} = stubWebAuthn();
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({publicKey: {publicKey: {challenge: "c", rpId: "localhost"}}, mediation: null}))
            .mockResolvedValueOnce(jsonResponse({
                identityId: "identity-1",
                access_token: "at-1",
                token_type: "Bearer",
                expires_in: 900,
                refresh_token: "rt-1",
                emailVerified: true,
            }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await loginWithPasskey("+66812345678");

        expect(parseRequestOptionsFromJSON).toHaveBeenCalledWith({challenge: "c", rpId: "localhost"});
        expect(get).toHaveBeenCalledTimes(1);
        expect(res.state).toBe("success");
        if (res.state === "success") {
            expect(res.data).toEqual({
                identityId: "identity-1",
                accessToken: "at-1",
                tokenType: "Bearer",
                expiresIn: 900,
                refreshToken: "rt-1",
                email: undefined,
                emailVerified: true,
            });
        }
        expect(rememberedPasskeyIdentifier()).toBe("+66812345678");
    });

    it("loginWithPasskey fails cleanly when no passkey matches (server 404s the challenge)", async () => {
        stubWebAuthn();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
            jsonResponse({error: "credential_not_found"}, {status: 404}),
        ));

        const res = await loginWithPasskey("+66812345678");

        expect(res.state).toBe("failed");
        if (res.state === "failed") {
            expect(res.err.error).toBe("credential_not_found");
        }
        expect(rememberedPasskeyIdentifier()).toBeNull();
    });

    it("loginWithPasskey fails without calling the network when unsupported", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await loginWithPasskey("+66812345678");

        expect(fetchMock).not.toHaveBeenCalled();
        expect(res.state).toBe("failed");
        if (res.state === "failed") {
            expect(res.err.error).toBe("passkeyNotSupported");
        }
    });
});
