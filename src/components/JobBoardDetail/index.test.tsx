// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import JobBoardDetail from "@/components/JobBoardDetail";
import {REQUEST_STATE} from "@/services/HttpService";

const mockUseHttpGet = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({lang: "en"}),
    useRouter: () => ({push: vi.fn(), back: vi.fn()}),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: {language: "en"},
    }),
}));

vi.mock("@/services", () => ({
    UserService: {
        Instance: {isLoggedIn: true},
    },
}));

vi.mock("@/store/useUserStore", () => ({
    useUserStore: () => ({
        person: {id: 1, isVerified: "Verified"},
    }),
}));

vi.mock("@/components/Common/NotFound", () => ({
    default: () => createElement("div", {id: "not-found"}, "Job Not Found"),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("JobBoardDetail", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        mockRefetch.mockClear();
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    it("renders error state with retry button when getPost fails", () => {
        mockUseHttpGet.mockReturnValue({
            data: null,
            isLoading: false,
            isMutating: false,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(JobBoardDetail, {jobId: 100 as any}));
        });

        expect(container.querySelector("#not-found")).toBeNull();
        expect(container.textContent).toContain("Failed to load job post");
        expect(container.textContent).toContain("Retry");

        const retryBtn = container.querySelector("button");
        expect(retryBtn).not.toBeNull();
        act(() => {
            retryBtn?.click();
        });
        expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it("renders NotFound when getPost succeeds but postView is null", () => {
        mockUseHttpGet.mockReturnValue({
            data: {postView: null},
            isLoading: false,
            isMutating: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(JobBoardDetail, {jobId: 999 as any}));
        });

        expect(container.querySelector("#not-found")).not.toBeNull();
        expect(container.textContent).toContain("Job Not Found");
    });
});
