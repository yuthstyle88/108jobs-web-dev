// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import EditPostPage from "@/app/[lang]/(job)/job-board/edit/[jobId]/page";
import {REQUEST_STATE} from "@/services/HttpService";

const mockUseHttpGet = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({jobId: "123", lang: "en"}),
    useRouter: () => ({push: vi.fn(), back: vi.fn()}),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

vi.mock("@/components/Job/PostForm", () => ({
    PostForm: () => createElement("div", {id: "post-form"}, "Post Form"),
}));

vi.mock("@/components/Common/NotFound", () => ({
    default: () => createElement("div", {id: "not-found"}, "Job Not Found"),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("EditPostPage", () => {
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

    it("renders error state with retry button when API fails (does NOT show not-found)", () => {
        mockUseHttpGet.mockReturnValue({
            data: null,
            isMutating: false,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Network Error")},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(EditPostPage));
        });

        expect(container.querySelector("#not-found")).toBeNull();
        expect(container.textContent).toContain("error.loadJobPostFailed");
        expect(container.textContent).toContain("global.buttonRetry");

        const retryButton = container.querySelector("button");
        expect(retryButton).not.toBeNull();
        act(() => {
            retryButton?.click();
        });
        expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it("renders NotFound when API succeeds but postView is null", () => {
        mockUseHttpGet.mockReturnValue({
            data: {postView: null},
            isMutating: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(EditPostPage));
        });

        expect(container.querySelector("#not-found")).not.toBeNull();
        expect(container.textContent).toContain("Job Not Found");
    });

    it("renders PostForm when API succeeds with valid postView", () => {
        mockUseHttpGet.mockReturnValue({
            data: {postView: {post: {id: 123, name: "Test Job"}}},
            isMutating: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(EditPostPage));
        });

        expect(container.querySelector("#post-form")).not.toBeNull();
        expect(container.textContent).toContain("Post Form");
    });
});
