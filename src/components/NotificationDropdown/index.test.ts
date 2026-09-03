// @vitest-environment jsdom
/**
 * Regression guard for #140, at the branch the user actually sees.
 *
 * The dropdown is mounted with the real component tree; only the store,
 * next/navigation and react-i18next are mocked. `t` echoes its key, so the
 * assertions below look for the literal dotted keys in the rendered DOM.
 *
 * If anyone folds the failure back into the empty branch, the first two tests
 * go red: a 500 would once again render "no notifications yet".
 */
import {act, createElement} from "react";
import {createRoot, type Root} from "react-dom/client";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

import {en} from "@/translations/en";
import {th} from "@/translations/th";
import {vi as viTranslation} from "@/translations/vi";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({t: (key: string) => key, i18n: {language: "en"}}),
}));
vi.mock("next/navigation", () => ({useRouter: () => ({push: vi.fn()})}));

const store = vi.hoisted(() => ({
    fetchNotifications: vi.fn(),
    fetchUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    current: {
        notifications: [] as unknown[],
        unreadCount: 0,
        loading: false,
        hasFetched: true,
        loadFailed: false,
    },
}));

vi.mock("@/store/useNotificationStore", () => ({
    useNotificationStore: () => ({
        ...store.current,
        fetchNotifications: store.fetchNotifications,
        fetchUnreadCount: store.fetchUnreadCount,
        markAsRead: store.markAsRead,
        markAllAsRead: store.markAllAsRead,
    }),
}));

import NotificationDropdown from "@/components/NotificationDropdown";

const actEnvironment = globalThis as typeof globalThis & {IS_REACT_ACT_ENVIRONMENT: boolean};
const LOAD_ERROR = "notifications.loadErrorTitle";
const RETRY = "notifications.loadErrorRetry";
const EMPTY = "notifications.emptyState";

describe("NotificationDropdown: a failed fetch is not an empty inbox", () => {
    let container: HTMLDivElement;
    let root: Root;

    const render = () => act(() => root.render(createElement(NotificationDropdown)));

    beforeEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        store.current = {
            notifications: [],
            unreadCount: 0,
            loading: false,
            hasFetched: true,
            loadFailed: false,
        };
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    });

    it("shows the failure copy, and not the empty-state copy, when the fetch failed", () => {
        store.current = {...store.current, loadFailed: true};

        render();

        expect(container.textContent).toContain(LOAD_ERROR);
        expect(container.textContent).not.toContain(EMPTY);
    });

    it("offers a retry that re-runs the fetch", () => {
        store.current = {...store.current, loadFailed: true};

        render();
        const retry = Array.from(container.querySelectorAll("button")).find(
            (b) => b.textContent === RETRY,
        );
        expect(retry).toBeDefined();

        // The bell's own toggle also calls fetchNotifications, so count from
        // zero after the render rather than asserting a total.
        store.fetchNotifications.mockClear();
        act(() => retry!.click());
        expect(store.fetchNotifications).toHaveBeenCalledTimes(1);
    });

    it("marks the failure block with the testid the empty-state case asserts is absent", () => {
        // ถ้าไม่มี attribute นี้ assertion ในเคสถัดไปจะผ่านเสมอไม่ว่าจะเรนเดอร์อะไร (#144)
        store.current = {...store.current, loadFailed: true};

        render();

        expect(container.querySelector('[data-testid="notification-load-error"]')).not.toBeNull();
    });

    it("does not caption the spinner with the empty-inbox copy", () => {
        // แคปชั่นตอนกำลังโหลดเคยเป็นคีย์ `emptyState` = บอกว่าไม่มีอะไร ระหว่างที่ยังโหลดอยู่
        store.current = {...store.current, loading: true, hasFetched: false};

        render();

        expect(container.textContent).toContain("notifications.loading");
        expect(container.textContent).not.toContain(EMPTY);
    });

    it("shows the empty-state copy, and no retry, when the server returned no rows", () => {
        render();

        expect(container.textContent).toContain(EMPTY);
        expect(container.textContent).not.toContain(LOAD_ERROR);
        expect(container.querySelector('[data-testid="notification-load-error"]')).toBeNull();
    });

    it("keeps showing the rows it has when a later refresh fails", () => {
        // A failed refresh must not blank a list the user is reading; the
        // store keeps the rows, so the list branch still wins.
        store.current = {
            ...store.current,
            loadFailed: true,
            notifications: [
                {
                    id: 1,
                    kind: "RiderApplicationApproved",
                    createdAt: "2026-09-01T00:00:00Z",
                    readAt: null,
                },
            ],
        };

        render();

        expect(container.textContent).toContain("notifications.riderApprovedTitle");
        expect(container.textContent).not.toContain(EMPTY);
    });
});

describe("NotificationDropdown translations", () => {
    it("has the new failure keys in all three locales, non-empty", () => {
        for (const tree of [en, th, viTranslation]) {
            for (const key of ["loading", "loadErrorTitle", "loadErrorRetry", "loadErrorRetrying"] as const) {
                const value = tree.translation.notifications[key];
                expect(typeof value).toBe("string");
                expect(value.length).toBeGreaterThan(0);
            }
        }
    });
});
