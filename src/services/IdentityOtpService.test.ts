// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {normalizeThaiPhone, requestOtp, verifyOtp} from "./IdentityOtpService";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: {"Content-Type": "application/json"},
        ...init,
    });
}

describe("normalizeThaiPhone", () => {
    it("converts a domestic 0-prefixed number to E.164", () => {
        expect(normalizeThaiPhone("0812345678")).toBe("+66812345678");
    });

    it("strips punctuation before normalizing", () => {
        expect(normalizeThaiPhone("081-234-5678")).toBe("+66812345678");
        expect(normalizeThaiPhone("081 234 5678")).toBe("+66812345678");
    });

    it("passes through an already-E.164 number", () => {
        expect(normalizeThaiPhone("+66812345678")).toBe("+66812345678");
    });

    it("converts a 0066-prefixed number", () => {
        expect(normalizeThaiPhone("0066812345678")).toBe("+66812345678");
    });

    it("converts a bare 66-prefixed number", () => {
        expect(normalizeThaiPhone("66812345678")).toBe("+66812345678");
    });

    it("refuses a domestic number with the wrong digit count", () => {
        expect(normalizeThaiPhone("012345678")).toBeNull(); // 8 digits after the leading 0
        expect(normalizeThaiPhone("08123456789")).toBeNull(); // 10 digits after the leading 0
    });

    it("refuses an E.164 candidate outside the 8-15 digit range", () => {
        expect(normalizeThaiPhone("+1234567")).toBeNull(); // 7
        expect(normalizeThaiPhone("+1234567890123456")).toBeNull(); // 16
    });

    it("refuses empty or non-numeric input", () => {
        expect(normalizeThaiPhone("")).toBeNull();
        expect(normalizeThaiPhone("abc")).toBeNull();
    });

    it("refuses a bare 66-prefixed number that's too short to be a real number", () => {
        expect(normalizeThaiPhone("66123")).toBeNull();
    });
});

describe("requestOtp / verifyOtp", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_IDENTITY_BASE_URL", "http://localhost:8090");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("requestOtp posts destination+channel and returns the challenge on success", async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({challengeId: "c1", expiresAt: 1234567890}));
        vi.stubGlobal("fetch", fetchMock);

        const res = await requestOtp("+66812345678");

        expect(fetchMock).toHaveBeenCalledWith("http://localhost:8090/auth/otp/request", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({destination: "+66812345678", channel: "sms"}),
        }));
        expect(res.state).toBe("success");
        if (res.state === "success") {
            expect(res.data).toEqual({challengeId: "c1", expiresAt: 1234567890});
        }
    });

    it("requestOtp surfaces the server's error code on failure", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({error: "rate_limited"}, {status: 429})));

        const res = await requestOtp("+66812345678");

        expect(res.state).toBe("failed");
        if (res.state === "failed") {
            expect(res.err.error).toBe("rate_limited");
        }
    });

    it("requestOtp fails without calling the network when Identity-Platform isn't configured", async () => {
        vi.unstubAllEnvs(); // NEXT_PUBLIC_IDENTITY_BASE_URL unset
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const res = await requestOtp("+66812345678");

        expect(fetchMock).not.toHaveBeenCalled();
        expect(res.state).toBe("failed");
        if (res.state === "failed") {
            expect(res.err.error).toBe("identityNotConfigured");
        }
    });

    it("requestOtp fails cleanly on a network error", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

        const res = await requestOtp("+66812345678");

        expect(res.state).toBe("failed");
        if (res.state === "failed") {
            expect(res.err.message).toBe("offline");
        }
    });

    it("verifyOtp sends registerIfAbsent:true and maps the nested login (snake_case OAuth fields, camelCase the rest)", async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
            verified: true,
            registered: true,
            login: {
                identityId: "id-1",
                access_token: "at-1",
                token_type: "Bearer",
                expires_in: 900,
                refresh_token: "rt-1",
                emailVerified: false,
            },
        }));
        vi.stubGlobal("fetch", fetchMock);

        const res = await verifyOtp("challenge-1", "123456");

        expect(fetchMock).toHaveBeenCalledWith("http://localhost:8090/auth/otp/verify", expect.objectContaining({
            method: "POST",
            body: JSON.stringify({challengeId: "challenge-1", code: "123456", registerIfAbsent: true}),
        }));
        expect(res.state).toBe("success");
        if (res.state === "success") {
            expect(res.data).toEqual({
                verified: true,
                registered: true,
                login: {
                    identityId: "id-1",
                    accessToken: "at-1",
                    tokenType: "Bearer",
                    expiresIn: 900,
                    refreshToken: "rt-1",
                    email: undefined,
                    emailVerified: false,
                },
            });
        }
    });

    it("verifyOtp surfaces invalid_code on a wrong code", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({error: "invalid_code"}, {status: 401})));

        const res = await verifyOtp("challenge-1", "000000");

        expect(res.state).toBe("failed");
        if (res.state === "failed") {
            expect(res.err.error).toBe("invalid_code");
        }
    });

    it("verifyOtp treats a verified code with no login as a failure, not a crash", async () => {
        // The real shape when registerIfAbsent's use case still finds nothing
        // to log into -- `login` is omitted from the wire response entirely.
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({verified: true})));

        const res = await verifyOtp("challenge-1", "123456");

        expect(res.state).toBe("failed");
        if (res.state === "failed") {
            expect(res.err.error).toBe("otpLoginNotIssued");
        }
    });
});
