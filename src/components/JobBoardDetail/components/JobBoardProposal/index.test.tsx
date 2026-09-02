// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import JobBoardProposal from "@/components/JobBoardDetail/components/JobBoardProposal";
import {REQUEST_STATE} from "@/services/HttpService";

const mockUseHttpGet = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("@/hooks/api/http/useHttpPost", () => ({
    useHttpPost: () => ({execute: vi.fn()}),
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({lang: "en"}),
    useRouter: () => ({push: vi.fn()}),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
        i18n: {language: "en"},
    }),
}));

vi.mock("@/store/useUserStore", () => ({
    useUserStore: () => ({person: {id: 1}}),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("JobBoardProposal", () => {
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

    it("renders error state with retry when API fails (does NOT show 'no proposals')", () => {
        mockUseHttpGet.mockReturnValue({
            data: null,
            pagination: null,
            isMutating: false,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(JobBoardProposal, {postId: 100, jobCreatorId: 2}));
        });

        expect(container.textContent).not.toContain("jobBoardDetail.noProposal");
        expect(container.textContent).toContain("Failed to load proposals");
        expect(container.textContent).toContain("Retry");

        const retryBtn = container.querySelector("button");
        expect(retryBtn).not.toBeNull();
        act(() => {
            retryBtn?.click();
        });
        expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it("renders empty state when API succeeds with no proposals", () => {
        mockUseHttpGet.mockReturnValue({
            data: {proposals: []},
            pagination: null,
            isMutating: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(JobBoardProposal, {postId: 100, jobCreatorId: 2}));
        });

        expect(container.textContent).toContain("jobBoardDetail.noProposal");
        expect(container.textContent).not.toContain("Failed to load proposals");
    });
});
