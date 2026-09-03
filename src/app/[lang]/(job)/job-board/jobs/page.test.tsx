// @vitest-environment jsdom

import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import MyJobs from "@/app/[lang]/(job)/job-board/jobs/page";
import {REQUEST_STATE} from "@/services/HttpService";

const mockUseHttpGet = vi.fn();
const mockRefetch = vi.fn();

vi.mock("@/hooks/api/http/useHttpGet", () => ({
    useHttpGet: (...args: any[]) => mockUseHttpGet(...args),
}));

vi.mock("next/navigation", () => ({
    useParams: () => ({lang: "en"}),
    useRouter: () => ({push: vi.fn()}),
}));

vi.mock("next/image", () => ({
    default: (props: any) => createElement("img", props),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

vi.mock("@/components/JobBoardTab", () => ({
    default: () => createElement("div", {id: "job-board-tab"}),
}));

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};

describe("MyJobs Page", () => {
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

    it("renders error state with retry when listPersonCreated fails (does NOT show 'no jobs')", () => {
        mockUseHttpGet.mockReturnValue({
            data: null,
            isMutating: false,
            state: {state: REQUEST_STATE.FAILED, err: new Error("Server error")},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(MyJobs));
        });

        expect(container.textContent).not.toContain("Your posted jobs will appear here");
        expect(container.textContent).toContain("error.loadJobsFailed");
        expect(container.textContent).toContain("global.buttonRetry");

        const retryBtn = container.querySelector("button");
        expect(retryBtn).not.toBeNull();
        act(() => {
            retryBtn?.click();
        });
        expect(mockRefetch).toHaveBeenCalled();
    });

    it("renders empty state when listPersonCreated succeeds with empty list", () => {
        mockUseHttpGet.mockReturnValue({
            data: {created: []},
            isMutating: false,
            state: {state: REQUEST_STATE.SUCCESS},
            execute: mockRefetch,
        });

        act(() => {
            root.render(createElement(MyJobs));
        });

        expect(container.textContent).toContain("profileJob.noJob");
        expect(container.textContent).not.toContain("error.loadJobsFailed");
    });
});
