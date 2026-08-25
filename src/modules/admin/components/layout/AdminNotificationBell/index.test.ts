// @vitest-environment jsdom
/**
 * The bell renders for real; only the two data hooks (the network boundary) and
 * react-i18next are mocked, with the same echo-key `t` the sibling admin suites
 * use. The panel body lives in a Radix portal that only mounts while the menu is
 * open, so the tests that need rows open it first and then query `document.body`
 * rather than the render container.
 */
import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import type {NotificationWithDecision} from "108jobs-client";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
    useRouter: () => ({push: routerPush, replace: vi.fn(), prefetch: vi.fn()}),
}));
vi.mock("@/modules/admin/hooks/useAdminNotifications", () => ({
    useAdminNotifications: vi.fn(),
    ADMIN_NOTIFICATION_PANEL_LIMIT: 10,
}));
vi.mock("@/modules/admin/hooks/useUnresolvedRiderCount", () => ({
    useUnresolvedRiderCount: vi.fn(),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {language: "en"},
    }),
}));

import {useAdminNotifications} from "@/modules/admin/hooks/useAdminNotifications";
import {useUnresolvedRiderCount} from "@/modules/admin/hooks/useUnresolvedRiderCount";
import {AdminNotificationBell, riderReviewHref} from ".";

const mockList = useAdminNotifications as unknown as ReturnType<typeof vi.fn>;
const mockCount = useUnresolvedRiderCount as unknown as ReturnType<typeof vi.fn>;

function fakeNotification(over: Partial<NotificationWithDecision> = {}): NotificationWithDecision {
    return {
        id: 1,
        sourceEventId: "8f0f1f1e-0000-4000-8000-000000000000",
        kind: "RiderApplicationSubmitted",
        recipientLocalUserId: null,
        recipientRole: "Admin",
        riderId: 12,
        riderDecisionId: null,
        createdAt: "2026-08-25T04:50:00Z",
        readAt: null,
        resolvedAt: null,
        resolvedByLocalUserId: null,
        ...over,
    } as NotificationWithDecision;
}

describe("AdminNotificationBell", () => {
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

    function mount(
        notifications: NotificationWithDecision[] = [],
        count: number | null = notifications.length,
    ) {
        mockList.mockReturnValue({notifications, isLoading: false, error: null, refresh: vi.fn()});
        mockCount.mockReturnValue({count, isLoading: false, refresh: vi.fn()});
        act(() => {
            root.render(createElement(AdminNotificationBell));
        });
    }

    function openPanel() {
        const trigger = container.querySelector<HTMLButtonElement>("button");
        act(() => {
            trigger!.dispatchEvent(
                new PointerEvent("pointerdown", {bubbles: true, button: 0, ctrlKey: false}),
            );
        });
    }

    it("builds a review link that names the rider", () => {
        expect(riderReviewHref(12)).toBe("/admin/manage-riders?rider=12");
    });

    // The badge must read the count endpoint, not the length of this page of
    // rows. The panel asks for ten; a queue of fifty would otherwise say "10".
    it("shows the queue depth from the count, not the number of rows it fetched", () => {
        mount([fakeNotification({id: 1}), fakeNotification({id: 2})], 50);

        const dot = container.querySelector('[data-testid="admin-notification-dot"]');
        expect(dot?.textContent).toBe("50");
    });

    it("caps a very large queue depth rather than overflowing the badge", () => {
        mount([], 1240);
        expect(
            container.querySelector('[data-testid="admin-notification-dot"]')?.textContent,
        ).toBe("99+");
    });

    it("shows no badge when nothing is waiting", () => {
        mount([], 0);
        expect(container.querySelector('[data-testid="admin-notification-dot"]')).toBeNull();
    });

    // `count` is null while the request is in flight. Rendering that as 0 would
    // be a claim we cannot make yet, and a badge that flickers in afterwards.
    it("shows no badge before the count has loaded", () => {
        mount([], null);
        expect(container.querySelector('[data-testid="admin-notification-dot"]')).toBeNull();
    });

    it("describes the queue depth to screen readers", () => {
        mount([], 3);
        const label = container.querySelector("button")?.getAttribute("aria-label");
        expect(label).toBe("admin.notifications.bellLabelWithCount");
    });

    it("lists a row per waiting application, labelled by kind", () => {
        mount([
            fakeNotification({id: 1, riderId: 12, kind: "RiderApplicationSubmitted"}),
            fakeNotification({id: 2, riderId: 13, kind: "RiderApplicationResubmitted"}),
        ]);
        openPanel();

        const text = document.body.textContent ?? "";
        expect(text).toContain("admin.notifications.kindSubmitted");
        // A resubmission is a different event from a first submission -- it means
        // this application has already been round once, which is exactly what the
        // count on its own cannot say.
        expect(text).toContain("admin.notifications.kindResubmitted");
    });

    it("opens the rider's application when a row is clicked", () => {
        mount([fakeNotification({id: 1, riderId: 12})]);
        openPanel();

        // Rows are menu items rather than plain buttons, so that selecting one
        // closes the panel instead of leaving it open over the application it
        // just opened.
        const row = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) =>
            (el.textContent ?? "").includes("admin.notifications.kindSubmitted"),
        );
        expect(row).toBeDefined();
        act(() => (row as HTMLElement).click());

        expect(routerPush).toHaveBeenCalledWith("/admin/manage-riders?rider=12");
    });

    // A row with no rider is not clickable to anywhere, so it would be a dead
    // entry in the panel. `riderId` is nullable on the wire.
    it("leaves out a notification that names no rider", () => {
        mount([fakeNotification({id: 1, riderId: null})], 1);
        openPanel();

        expect(document.body.textContent).not.toContain("admin.notifications.kindSubmitted");
        expect(document.body.textContent).toContain("admin.notifications.empty");
    });
});
