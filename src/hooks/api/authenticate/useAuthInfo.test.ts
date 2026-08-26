// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import type { LocalUser, LocalUserView, MyUserInfo, Person } from "108heros-client";
import { UserService, JOBS_ADMIN_ROLE, type Claims } from "@/services/UserService";

interface MockStoreState {
    userInfo: MyUserInfo | null;
    claims: Claims | null;
}

const { mockState } = vi.hoisted(() => {
    return {
        mockState: {
            userInfo: null as MyUserInfo | null,
            claims: null as Claims | null,
        },
    };
});

vi.mock("@/store/useUserStore", () => {
    const useUserStore = Object.assign(
        (selector: (s: MockStoreState) => unknown) => selector(mockState),
        {
            getState: () => ({
                ...mockState,
                setClaims: (claims: Claims | null) => {
                    mockState.claims = claims;
                },
                resetStore: () => {
                    mockState.userInfo = null;
                    mockState.claims = null;
                },
            }),
        }
    );
    return { useUserStore };
});

import { useAuthInfo } from "./useAuthInfo";

describe("useAuthInfo", () => {
    beforeEach(() => {
        mockState.userInfo = null;
        mockState.claims = null;
        UserService.Instance.authInfo = undefined;
    });

    it("returns isLoggedIn: false and isAdmin: false when no user is logged in", () => {
        const info = useAuthInfo();
        expect(info.isLoggedIn).toBe(false);
        expect(info.isAdmin).toBe(false);
        expect(info.userInfo).toBeNull();
    });

    it("returns isAdmin: false when localUser has admin: true but claims lack jobs:admin", () => {
        const mockUserInfo: Partial<MyUserInfo> = {
            localUserView: {
                banned: false,
                localUser: {
                    id: 1,
                    username: "rider1",
                    email: "rider1@example.com",
                    admin: true,
                    interfaceLanguage: "en",
                } as unknown as LocalUser,
                person: {} as unknown as Person,
            } as LocalUserView,
        };
        mockState.userInfo = mockUserInfo as MyUserInfo;
        mockState.claims = {
            sub: "1",
            iss: "auth",
            aud: "jobs",
            exp: 9999999999,
            iat: 1000,
            roles: ["jobs:rider"],
            realm: "r",
            platform: "p",
            tenant_id: "t",
        };

        const info = useAuthInfo();
        expect(info.isLoggedIn).toBe(true);
        expect(info.isAdmin).toBe(false);
    });

    it("returns isAdmin: true when claims contain jobs:admin", () => {
        const mockUserInfo: Partial<MyUserInfo> = {
            localUserView: {
                banned: false,
                localUser: {
                    id: 2,
                    username: "admin1",
                    email: "admin1@example.com",
                    admin: false, // Even if localUser.admin is false, verified roles claim wins
                    interfaceLanguage: "th",
                } as unknown as LocalUser,
                person: {} as unknown as Person,
            } as LocalUserView,
        };
        mockState.userInfo = mockUserInfo as MyUserInfo;
        mockState.claims = {
            sub: "2",
            iss: "auth",
            aud: "jobs",
            exp: 9999999999,
            iat: 1000,
            roles: ["jobs:user", JOBS_ADMIN_ROLE],
            realm: "r",
            platform: "p",
            tenant_id: "t",
        };

        const info = useAuthInfo();
        expect(info.isLoggedIn).toBe(true);
        expect(info.isAdmin).toBe(true);
    });

    it("falls back to UserService instance claims if useUserStore claims is not yet set", () => {
        const mockUserInfo: Partial<MyUserInfo> = {
            localUserView: {
                banned: false,
                localUser: {
                    id: 3,
                    username: "admin2",
                    email: "admin2@example.com",
                    admin: false,
                    interfaceLanguage: "vi",
                } as unknown as LocalUser,
                person: {} as unknown as Person,
            } as LocalUserView,
        };
        mockState.userInfo = mockUserInfo as MyUserInfo;
        UserService.Instance.authInfo = {
            auth: "token",
            claims: {
                sub: "3",
                iss: "auth",
                aud: "jobs",
                exp: 9999999999,
                iat: 1000,
                roles: [JOBS_ADMIN_ROLE],
                realm: "r",
                platform: "p",
                tenant_id: "t",
            },
        };

        const info = useAuthInfo();
        expect(info.isLoggedIn).toBe(true);
        expect(info.isAdmin).toBe(true);
    });
});
