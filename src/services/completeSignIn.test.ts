// @vitest-environment jsdom
import {beforeEach, describe, expect, it, vi} from "vitest";
import {completeSignIn} from "@/services/authRedirect";
import {jwtDecode} from "jwt-decode";
import {JOBS_ADMIN_ROLE, Claims} from "@/services/UserService";

vi.mock("@/services", () => ({
    UserService: {
        Instance: {
            login: vi.fn().mockResolvedValue(undefined),
        },
    },
}));

vi.mock("jwt-decode", () => ({
    jwtDecode: vi.fn(),
}));

describe("completeSignIn (call site redirect verification)", () => {
    beforeEach(() => {
        Object.defineProperty(window, "location", {
            value: {href: ""},
            writable: true,
            configurable: true,
        });
        vi.clearAllMocks();
    });

    it("falls back to site root for a backslash protocol-relative redirect URL for normal user", async () => {
        vi.mocked(jwtDecode).mockReturnValue({
            roles: ["user"],
        } as Claims);

        await completeSignIn("mock-user-token", undefined, "/\\evil.example");

        expect(window.location.href).toBe("/");
        expect(window.location.href).not.toContain("evil.example");
    });

    it("allows a legitimate relative path for normal user", async () => {
        vi.mocked(jwtDecode).mockReturnValue({
            roles: ["user"],
        } as Claims);

        await completeSignIn("mock-user-token", undefined, "/th/profile");

        expect(window.location.href).toBe("/th/profile");
    });

    it("redirects to admin dashboard when token has admin role regardless of redirectUrl", async () => {
        vi.mocked(jwtDecode).mockReturnValue({
            roles: [JOBS_ADMIN_ROLE],
        } as Claims);

        await completeSignIn("mock-admin-token", undefined, "/\\evil.example");

        expect(window.location.href).toBe("/admin/dashboard");
    });
});
