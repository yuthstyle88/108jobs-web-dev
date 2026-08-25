// @vitest-environment jsdom
/**
 * AdminRidersManagementPage renders the actual row markup for real; only
 * the data-fetching hook (usePaginatedRiders, the network boundary) and
 * react-i18next are mocked (same echo-key `t` as
 * RiderReviewModal/index.test.ts). AdminLayout is also mocked to a plain
 * passthrough -- it pulls in AdminSidebar/AdminHeader, which need session
 * and routing context that has nothing to do with this page's own row
 * rendering.
 */
import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {ReactNode} from "react";
import type {Rider, RiderView} from "108jobs-client";

// The page reads the query string to open an application straight from the
// notification bell, so it needs a router. Held in module-level boxes the tests
// reassign, because vi.mock is hoisted above any per-test state.
let currentSearch = new URLSearchParams();
// Faithful to the real router: navigating changes what `useSearchParams` returns.
// A `vi.fn()` that only records the call would let the deep-link tests pass while
// the page's actual close path -- which works by dropping the parameter -- was
// broken, because the URL would never stop naming the rider.
const routerReplace = vi.fn((url: string) => {
    currentSearch = new URLSearchParams(url.split("?")[1] ?? "");
});
vi.mock("next/navigation", () => ({
    useRouter: () => ({replace: routerReplace, push: vi.fn(), prefetch: vi.fn()}),
    useSearchParams: () => currentSearch,
}));
vi.mock("@/modules/admin/hooks/usePaginatedRiders", () => ({usePaginatedRiders: vi.fn()}));
vi.mock("@/modules/admin/hooks/useUnresolvedRiderCount", () => ({useUnresolvedRiderCount: vi.fn()}));
vi.mock("@/modules/admin/hooks/useAdminQueueRefresh", () => ({useAdminQueueRefresh: vi.fn()}));
vi.mock("@/modules/admin/components/layout/AdminLayout", () => ({
    AdminLayout: ({children}: {children: ReactNode}) => children,
}));
// Stubbed down to a single button that fires `onReviewed`. Driving the real
// modal's approve flow would test the modal, not this page's wiring -- and the
// modal has its own suite for that. No other test in this file opens the modal
// (`reviewingRider` starts null), so the stub is inert for them.
vi.mock("@/modules/admin/components/Modal/RiderReviewModal", () => ({
    RiderReviewModal: (
        {rider, onReviewed, onClose}:
            {rider: {id: number}; onReviewed: () => void; onClose: () => void},
    ) =>
        createElement("div", null,
            createElement("button", {
                "data-testid": "stub-finish-review",
                "data-rider-id": String(rider.id),
                onClick: onReviewed,
            }),
            createElement("button", {"data-testid": "stub-close-review", onClick: onClose}),
        ),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key}),
}));

import {usePaginatedRiders} from "@/modules/admin/hooks/usePaginatedRiders";
import {useUnresolvedRiderCount} from "@/modules/admin/hooks/useUnresolvedRiderCount";
import {useAdminQueueRefresh} from "@/modules/admin/hooks/useAdminQueueRefresh";
import AdminRidersManagementPage from "@/app/[lang]/admin/manage-riders/page";

// usePaginatedRiders is generic-free at the call site here, so the mock
// factory's vi.fn() is cast the same way RiderReviewModal/index.test.ts
// casts useHttpGet/useHttpPost -- gives mockReturnValue etc. without `any`.
const mockUsePaginatedRiders = usePaginatedRiders as unknown as ReturnType<typeof vi.fn>;
const mockUseUnresolvedRiderCount = useUnresolvedRiderCount as unknown as ReturnType<typeof vi.fn>;
const mockUseAdminQueueRefresh = useAdminQueueRefresh as unknown as ReturnType<typeof vi.fn>;

function fakeRider(overrides: Partial<Rider> = {}): Rider {
    return {
        id: 1,
        userId: 1,
        personId: 1,
        vehicleType: "Motorcycle",
        vehiclePlateNumber: null,
        isVerified: false,
        isActive: true,
        verificationStatus: "Pending",
        rating: 4.5,
        completedJobs: 10,
        totalJobs: 12,
        totalEarnings: 0,
        pendingEarnings: 0,
        isOnline: false,
        acceptingJobs: false,
        joinedAt: null,
        lastActiveAt: null,
        verifiedAt: null,
        ...overrides,
    };
}

// Only `name`/`displayName`/`avatar` are read by this page's row; the rest
// of Person is a large, unrelated profile shape this test has no stake in
// (same cast-through-unknown as RiderReviewModal/index.test.ts's fakeResponse).
function fakeRiderView(name: string, displayName?: string, riderOverrides: Partial<Rider> = {}): RiderView {
    return {
        rider: fakeRider(riderOverrides),
        person: {name, displayName, avatar: undefined} as unknown as RiderView["person"],
    };
}

describe("AdminRidersManagementPage", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.clearAllMocks();
        currentSearch = new URLSearchParams();
    });

    const refreshQueue = vi.fn();

    type HookState = ReturnType<typeof usePaginatedRiders> & {currentPage?: number};

    function mount(
        riders: RiderView[],
        overrides: Partial<HookState> = {},
        unresolved: number | null = null,
    ) {
        mockUseUnresolvedRiderCount.mockReturnValue({count: unresolved, isLoading: false});
        mockUseAdminQueueRefresh.mockReturnValue(refreshQueue);
        mockUsePaginatedRiders.mockReturnValue({
            riders,
            isLoading: false,
            error: null,
            hasNextPage: false,
            hasPreviousPage: false,
            loadNextPage: vi.fn(),
            loadPreviousPage: vi.fn(),
            refetch: vi.fn(),
            currentPage: 1,
            ...overrides,
        });

        act(() => {
            root.render(createElement(AdminRidersManagementPage));
        });
    }

    // The regression this fix wave exists to prevent: a rider with an empty
    // `name` used to throw inside the row render (`""[0]` is `undefined`,
    // and `.toUpperCase()` on `undefined` throws), which -- because this
    // runs inside `riders.map` with no error boundary around it -- took
    // down the whole page for every rider, not just the one with a blank
    // name.
    it("renders a rider with an empty name without throwing", () => {
        expect(() => mount([fakeRiderView("")])).not.toThrow();
        // Falls all the way through name -> displayName -> the "?" avatar
        // fallback and the translated "unknown" label -- not a blank crash.
        expect(container.textContent).toContain("?");
        expect(container.textContent).toContain("admin.riders.unknown");
    });

    it("renders a rider with a real name normally", () => {
        mount([fakeRiderView("Somchai Test")]);
        expect(container.textContent).toContain("Somchai Test");
        // Avatar-initial fallback.
        expect(container.textContent).toContain("S");
    });

    it("shows the unresolved count on Pending, and only there", () => {
        mount([fakeRiderView("Somchai Test")], {}, 4);

        const badge = container.querySelector("[data-testid='unresolved-rider-count']");
        expect(badge).not.toBeNull();
        expect(badge?.textContent).toBe("4");

        // Verified and Rejected are outcomes, not a backlog. Exactly one badge
        // on the page proves it did not leak onto the other two tabs.
        expect(
            container.querySelectorAll("[data-testid='unresolved-rider-count']"),
        ).toHaveLength(1);

        const pending = Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent?.includes("admin.riders.tabPending"),
        );
        expect(pending?.contains(badge as Node)).toBe(true);
    });

    it("hides the badge when the queue is empty", () => {
        // Zero is a real answer -- the queue is clear -- and a "0" chip beside
        // Pending is visual noise claiming there is something to look at.
        mount([fakeRiderView("Somchai Test")], {}, 0);
        expect(
            container.querySelector("[data-testid='unresolved-rider-count']"),
        ).toBeNull();
    });

    it("hides the badge before the count has loaded", () => {
        // Null, not zero: rendering "0" while the request is in flight would
        // tell an admin their queue is clear a moment before showing that it
        // is not.
        mount([fakeRiderView("Somchai Test")], {}, null);
        expect(
            container.querySelector("[data-testid='unresolved-rider-count']"),
        ).toBeNull();
    });

    function findButton(labelKey: string) {
        return Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent?.includes(labelKey),
        ) as HTMLButtonElement;
    }

    // Task 9's whole point: three states, three tabs, three wire values --
    // and the label is not the wire value. "Approved" is the tab's English
    // text; "Verified" is what usePaginatedRiders (and so the request) must
    // receive. Nothing asserted this before; a tab wired to the wrong status
    // would still compile, still render, and still pass every other test in
    // this file (F2).
    it("sends each tab's own wire value to usePaginatedRiders -- the Approved tab must send \"Verified\", not its own label", () => {
        mount([]);
        expect(mockUsePaginatedRiders).toHaveBeenLastCalledWith({status: "Pending", limit: 10});

        act(() => findButton("admin.riders.tabApproved").click());
        expect(mockUsePaginatedRiders).toHaveBeenLastCalledWith({status: "Verified", limit: 10});

        act(() => findButton("admin.riders.tabRejected").click());
        expect(mockUsePaginatedRiders).toHaveBeenLastCalledWith({status: "Rejected", limit: 10});

        act(() => findButton("admin.riders.tabPending").click());
        expect(mockUsePaginatedRiders).toHaveBeenLastCalledWith({status: "Pending", limit: 10});
    });

    // The exact bug Task 9's own review caught by reading, not by a test: a
    // two-way ternary on the row Badge would render "Verified" for both an
    // approved and a rejected rider. Three riders, three distinct ids (the
    // list key is `rider.id`), one of each status.
    it("renders the row Badge as three distinct states, not a Verified/not-Verified boolean", () => {
        mount([
            fakeRiderView("Pending Rider", undefined, {id: 1, verificationStatus: "Pending"}),
            fakeRiderView("Verified Rider", undefined, {id: 2, verificationStatus: "Verified"}),
            fakeRiderView("Rejected Rider", undefined, {id: 3, verificationStatus: "Rejected"}),
        ]);
        expect(container.textContent).toContain("admin.riders.statusPending");
        expect(container.textContent).toContain("admin.riders.statusVerified");
        expect(container.textContent).toContain("admin.riders.statusRejected");
    });

    it("selects the empty-state copy that matches the active tab, not one fixed message", () => {
        mount([]);
        expect(container.textContent).toContain("admin.riders.emptyPending");

        act(() => findButton("admin.riders.tabApproved").click());
        expect(container.textContent).toContain("admin.riders.emptyVerified");
        expect(container.textContent).not.toContain("admin.riders.emptyPending");

        act(() => findButton("admin.riders.tabRejected").click());
        expect(container.textContent).toContain("admin.riders.emptyRejected");
        expect(container.textContent).not.toContain("admin.riders.emptyVerified");
    });

    it("keeps Previous available when a later page is empty, so the admin is never trapped", () => {
        const loadPreviousPage = vi.fn();
        mount([], {
            currentPage: 2,
            hasPreviousPage: true,
            loadPreviousPage,
        });

        const previous = findButton("profileCoins.previousButton");
        expect(previous).toBeTruthy();
        expect(container.textContent).toContain("admin.riders.pageLabel");

        act(() => previous.click());
        expect(loadPreviousPage).toHaveBeenCalledOnce();
    });

    it("shows a visible review action instead of an unlabeled eye-only control", () => {
        mount([fakeRiderView("Somchai Test")]);

        expect(findButton("admin.riders.reviewRiderLabel")).toBeTruthy();
    });

    it("renders without animation or transition utility classes", () => {
        mount([fakeRiderView("Somchai Test")]);

        const motionClasses = Array.from(container.querySelectorAll<HTMLElement>("[class]"))
            .flatMap((element) => (element.getAttribute("class") ?? "").split(/\s+/))
            .filter((className) =>
                className !== "transition-none"
                && (
                    className.startsWith("animate-")
                    || className.startsWith("transition")
                    || className.startsWith("duration-")
                ),
            );

        expect(motionClasses).toEqual([]);
    });

    it("stays in the existing light admin palette without dark-theme overrides", () => {
        mount([fakeRiderView("Somchai Test")]);

        const darkThemeClasses = Array.from(container.querySelectorAll<HTMLElement>("[class]"))
            .flatMap((element) => (element.getAttribute("class") ?? "").split(/\s+/))
            .filter((className) => className.startsWith("dark:"));

        expect(darkThemeClasses).toEqual([]);
    });
    // Found in a live smoke test, not by a unit test: deciding a rider from the
    // modal left the queue's own numbers stale until the page was reloaded. The
    // riders list refetched, so the row correctly disappeared -- which made the
    // stale count look all the more like the truth. Both the badge and the
    // bell's list are separate SWR keys, and `revalidateOnFocus` cannot save
    // them here because the decision happens in this same, already-focused tab.
    it("invalidates the whole queue after a decision, not just the riders list", () => {
        const refetch = vi.fn();
        mount([fakeRiderView("Somchai Test")], {refetch}, 1);

        const reviewButton = container.querySelector<HTMLButtonElement>(
            '[aria-label="admin.riders.reviewRiderLabel"]',
        );
        expect(reviewButton).not.toBeNull();
        act(() => reviewButton!.click());

        const finish = container.querySelector<HTMLButtonElement>(
            '[data-testid="stub-finish-review"]',
        );
        expect(finish).not.toBeNull();
        act(() => finish!.click());

        expect(refetch).toHaveBeenCalledTimes(1);
        expect(refreshQueue).toHaveBeenCalledTimes(1);
    });
    // The bell hands over a rider id and nothing else, so the page has to be
    // able to open an application it was not already showing.
    it("opens the application named in the query string", () => {
        currentSearch = new URLSearchParams("rider=7");
        mount([fakeRiderView("Somchai Test")]);

        const modal = container.querySelector('[data-testid="stub-finish-review"]');
        expect(modal).not.toBeNull();
        expect(modal!.getAttribute("data-rider-id")).toBe("7");
    });

    // The queue page shows ten rows at a time; a notification can easily name a
    // rider sitting on page three. Opening only what happens to be on screen
    // would make those notifications dead links.
    it("opens a deep-linked rider who is not in the loaded page of results", () => {
        currentSearch = new URLSearchParams("rider=904");
        mount([fakeRiderView("Somebody Else")]);

        const modal = container.querySelector('[data-testid="stub-finish-review"]');
        expect(modal).not.toBeNull();
        expect(modal!.getAttribute("data-rider-id")).toBe("904");
    });

    it("ignores a rider parameter that is not a usable id", () => {
        currentSearch = new URLSearchParams("rider=not-a-number");
        mount([fakeRiderView("Somchai Test")]);

        expect(container.querySelector('[data-testid="stub-finish-review"]')).toBeNull();
    });

    // Closing has to drop the parameter as well as the state. If it only cleared
    // state the modal would reopen immediately, because the URL still names the
    // rider and the subject is derived from it.
    it("clears the query parameter when a deep-linked application is closed", () => {
        currentSearch = new URLSearchParams("rider=7");
        mount([fakeRiderView("Somchai Test")]);

        const close = container.querySelector<HTMLButtonElement>('[data-testid="stub-close-review"]');
        act(() => close!.click());

        expect(routerReplace).toHaveBeenCalledWith("/admin/manage-riders");

        // Next re-renders the page on navigation; nothing in this bare jsdom
        // setup does, and the close itself cannot trigger one -- it sets the
        // manual subject to null when it is already null, which React skips.
        // Rendering again is standing in for the router, not papering over a
        // missing update: the assertion that matters is that the page no longer
        // shows the application once the URL has stopped naming it.
        act(() => {
            root.render(createElement(AdminRidersManagementPage));
        });
        expect(container.querySelector('[data-testid="stub-finish-review"]')).toBeNull();
    });

    it("shows the application clicked in the queue even while a deep link is in the URL", () => {
        currentSearch = new URLSearchParams("rider=7");
        mount([fakeRiderView("Somchai Test")]);

        const review = container.querySelector<HTMLButtonElement>(
            '[aria-label="admin.riders.reviewRiderLabel"]',
        );
        act(() => review!.click());

        // fakeRiderView's rider id, not the 7 still sitting in the URL.
        expect(
            container.querySelector('[data-testid="stub-finish-review"]')!.getAttribute("data-rider-id"),
        ).toBe("1");
    });
    // Caught in a live click-through, not by a unit test. An earlier version
    // remembered "the admin dismissed rider 7" so that closing felt instant.
    // That made the rider unopenable from the bell for the rest of the page's
    // life: selecting it again pushes the very same URL, and the remembered
    // dismissal kept suppressing it. Closing has to be expressed as dropping the
    // parameter, nothing more.
    it("reopens the same rider after it was closed once", () => {
        currentSearch = new URLSearchParams("rider=7");
        mount([fakeRiderView("Somchai Test")]);

        const close = container.querySelector<HTMLButtonElement>('[data-testid="stub-close-review"]');
        act(() => close!.click());
        act(() => {
            root.render(createElement(AdminRidersManagementPage));
        });
        expect(container.querySelector('[data-testid="stub-finish-review"]')).toBeNull();

        // The bell selecting rider 7 again -- the same URL as the first time.
        currentSearch = new URLSearchParams("rider=7");
        act(() => {
            root.render(createElement(AdminRidersManagementPage));
        });

        const modal = container.querySelector('[data-testid="stub-finish-review"]');
        expect(modal).not.toBeNull();
        expect(modal!.getAttribute("data-rider-id")).toBe("7");
    });
});
