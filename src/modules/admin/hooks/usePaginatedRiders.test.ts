// @vitest-environment jsdom
/**
 * Regression coverage for #90: switching the admin rider-list tab while past
 * page 1 fetched the new tab with the previous tab's cursor, showing the
 * wrong page (or nothing, once that cursor ran past the new tab's own
 * results).
 *
 * Mounts the REAL usePaginatedRiders hook (only the network boundary --
 * useHttpGet, per RiderReviewModal/index.test.ts's precedent -- and
 * react-i18next are mocked) behind a small probe component, following
 * useFileUpload.test.ts's pattern for asserting on a hook's behaviour
 * without @testing-library/react: a callback hands the latest hook result
 * back to the test, and re-rendering the probe with new props is what
 * exercises "the status prop changed while the component stayed mounted" --
 * the exact case a remount would trivially (and misleadingly) pass.
 *
 * What's asserted is not the hook's return value but the *arguments it
 * passes to useHttpGet* -- i.e. the request that would actually go out.
 */
import {createElement} from "react";
import {act} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {RiderVerificationStatus} from "108jobs-client";

vi.mock("@/hooks/api/http/useHttpGet", () => ({useHttpGet: vi.fn()}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key}),
}));

import {useHttpGet} from "@/hooks/api/http/useHttpGet";
import {usePaginatedRiders} from "@/modules/admin/hooks/usePaginatedRiders";

// Same reasoning as RiderReviewModal/index.test.ts's mockUseHttpGet cast --
// useHttpGet is generic over the real API surface, which makes its static
// ReturnType unwieldy to reconstruct for a mock; at runtime this is just the
// vi.fn() from the factory above.
const mockUseHttpGet = useHttpGet as unknown as ReturnType<typeof vi.fn>;

function HookProbe({
    status,
    onHook,
}: {
    status: RiderVerificationStatus;
    onHook: (hook: ReturnType<typeof usePaginatedRiders>) => void;
}) {
    const hook = usePaginatedRiders({status, limit: 10});
    onHook(hook);
    return null;
}

describe("usePaginatedRiders", () => {
    let container: HTMLDivElement;
    let root: Root;
    let latestHook: ReturnType<typeof usePaginatedRiders> | null;

    beforeEach(() => {
        latestHook = null;
        // A fixed nextPage cursor regardless of the request args -- this
        // test only cares what usePaginatedRiders asks for, not about
        // round-tripping realistic response data.
        mockUseHttpGet.mockReturnValue({
            data: {riders: [], nextPage: "cursor-page-2"},
            isMutating: false,
            state: {state: "success"},
            execute: vi.fn(),
        });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllMocks();
    });

    function mount(status: RiderVerificationStatus) {
        act(() => {
            root.render(
                createElement(HookProbe, {
                    status,
                    onHook: (h) => {
                        latestHook = h;
                    },
                }),
            );
        });
    }

    /** The `adminListRiders` request args from the most recent useHttpGet call. */
    function lastRequestArgs() {
        const calls = mockUseHttpGet.mock.calls;
        return calls[calls.length - 1]?.[1];
    }

    it("resets the cursor when the tab changes, instead of carrying the previous tab's cursor into the new request", () => {
        mount("Pending");
        expect(lastRequestArgs()).toEqual({
            pageCursor: undefined,
            pageBack: false,
            limit: 10,
            status: "Pending",
        });

        // Page forward, so a real cursor is now held.
        act(() => {
            latestHook!.loadNextPage();
        });
        expect(lastRequestArgs()).toEqual({
            pageCursor: "cursor-page-2",
            pageBack: false,
            limit: 10,
            status: "Pending",
        });

        // Switch tabs. Against the pre-fix hook, `currentCursor` survives
        // this -- nothing resets it -- so the Rejected tab's first request
        // would still carry "cursor-page-2" from Pending.
        mount("Rejected");
        expect(lastRequestArgs()).toEqual({
            pageCursor: undefined,
            pageBack: false,
            limit: 10,
            status: "Rejected",
        });
    });
});
