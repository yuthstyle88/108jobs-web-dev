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

vi.mock("@/modules/admin/hooks/usePaginatedRiders", () => ({usePaginatedRiders: vi.fn()}));
vi.mock("@/modules/admin/components/layout/AdminLayout", () => ({
    AdminLayout: ({children}: {children: ReactNode}) => children,
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key}),
}));

import {usePaginatedRiders} from "@/modules/admin/hooks/usePaginatedRiders";
import AdminRidersManagementPage from "@/app/[lang]/admin/manage-riders/page";

// usePaginatedRiders is generic-free at the call site here, so the mock
// factory's vi.fn() is cast the same way RiderReviewModal/index.test.ts
// casts useHttpGet/useHttpPost -- gives mockReturnValue etc. without `any`.
const mockUsePaginatedRiders = usePaginatedRiders as unknown as ReturnType<typeof vi.fn>;

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
function fakeRiderView(name: string, displayName?: string): RiderView {
    return {
        rider: fakeRider(),
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
    });

    function mount(riders: RiderView[]) {
        mockUsePaginatedRiders.mockReturnValue({
            riders,
            isLoading: false,
            error: null,
            hasNextPage: false,
            hasPreviousPage: false,
            loadNextPage: vi.fn(),
            loadPreviousPage: vi.fn(),
            refetch: vi.fn(),
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
});
