import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("@/services/NotificationService", () => ({
    NotificationService: {
        list: vi.fn(),
        unreadCount: vi.fn(),
        markRead: vi.fn(),
    },
}));

import {NotificationService, type ServerNotificationItem} from "@/services/NotificationService";
import {useNotificationStore} from "@/store/useNotificationStore";

const mockList = NotificationService.list as unknown as ReturnType<typeof vi.fn>;

const ROW = {
    id: 1,
    kind: "RiderApplicationApproved",
    createdAt: "2026-09-01T00:00:00Z",
    readAt: null,
} as unknown as ServerNotificationItem;

const INITIAL = {notifications: [], unreadCount: 0, loading: false, hasFetched: false, loadFailed: false};

describe("useNotificationStore.fetchNotifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useNotificationStore.setState(INITIAL);
    });

    it("records the failure instead of leaving an empty list behind", async () => {
        mockList.mockResolvedValue({state: "failed", err: {status: 500, message: "Internal Server Error"}});

        await useNotificationStore.getState().fetchNotifications();

        const s = useNotificationStore.getState();
        expect(s.loadFailed).toBe(true);
        expect(s.loading).toBe(false);
        expect(s.hasFetched).toBe(true);
    });

    it("does NOT set loadFailed when the server genuinely returned no rows", async () => {
        // The whole point of the flag: an empty inbox and an outage must not
        // be the same store state.
        mockList.mockResolvedValue({state: "success", data: {notifications: []}});

        await useNotificationStore.getState().fetchNotifications();

        const s = useNotificationStore.getState();
        expect(s.loadFailed).toBe(false);
        expect(s.notifications).toEqual([]);
    });

    it("clears a previous failure once a fetch succeeds", async () => {
        mockList.mockResolvedValue({state: "failed", err: {status: 500}});
        await useNotificationStore.getState().fetchNotifications();
        expect(useNotificationStore.getState().loadFailed).toBe(true);

        mockList.mockResolvedValue({state: "success", data: {notifications: [ROW]}});
        await useNotificationStore.getState().fetchNotifications();

        const s = useNotificationStore.getState();
        expect(s.loadFailed).toBe(false);
        expect(s.notifications).toHaveLength(1);
        expect(s.unreadCount).toBe(1);
    });

    it("keeps rows that already arrived when a later refresh fails", async () => {
        mockList.mockResolvedValue({state: "success", data: {notifications: [ROW]}});
        await useNotificationStore.getState().fetchNotifications();

        mockList.mockResolvedValue({state: "failed", err: {status: 503}});
        await useNotificationStore.getState().fetchNotifications();

        const s = useNotificationStore.getState();
        expect(s.notifications).toHaveLength(1);
        expect(s.loadFailed).toBe(true);
    });
});
