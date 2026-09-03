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
const mockCount = NotificationService.unreadCount as unknown as ReturnType<typeof vi.fn>;

const ROW = {
    id: 1,
    kind: "RiderApplicationApproved",
    createdAt: "2026-09-01T00:00:00Z",
    readAt: null,
} as unknown as ServerNotificationItem;

const INITIAL = {notifications: [], unreadCount: 0, loading: false, hasFetched: false, loadFailed: false, unreadCountStale: false};

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

/**
 * #142. `NotificationService` never throws, so a failed count used to be
 * dropped in silence and the badge kept a number nobody had confirmed since —
 * for hours, at one poll every 45 seconds.
 *
 * Freezing the number is deliberate and zeroing it would be worse: it would
 * hide rows that really are unread. What the store owes the UI is the fact that
 * the number is old, which is what these tests pin.
 */
describe("useNotificationStore.fetchUnreadCount", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useNotificationStore.setState(INITIAL);
    });

    it("keeps the last confirmed number when the refresh fails, and says it is stale", async () => {
        useNotificationStore.setState({unreadCount: 4});
        mockCount.mockResolvedValue({state: "failed", err: {error: "serverError"}});

        await useNotificationStore.getState().fetchUnreadCount();

        // Not zero: zeroing hides unread rows that exist.
        expect(useNotificationStore.getState().unreadCount).toBe(4);
        expect(useNotificationStore.getState().unreadCountStale).toBe(true);
    });

    it("clears the staleness once a refresh succeeds", async () => {
        useNotificationStore.setState({unreadCount: 4, unreadCountStale: true});
        mockCount.mockResolvedValue({state: "success", data: {count: 7}});

        await useNotificationStore.getState().fetchUnreadCount();

        expect(useNotificationStore.getState().unreadCount).toBe(7);
        expect(useNotificationStore.getState().unreadCountStale).toBe(false);
    });

    /** Zero from the server is an answer, not a failure. */
    it("accepts a genuine zero without marking it stale", async () => {
        useNotificationStore.setState({unreadCount: 3});
        mockCount.mockResolvedValue({state: "success", data: {count: 0}});

        await useNotificationStore.getState().fetchUnreadCount();

        expect(useNotificationStore.getState().unreadCount).toBe(0);
        expect(useNotificationStore.getState().unreadCountStale).toBe(false);
    });

    /**
     * The list counts the unread rows itself, so a successful list is a fresher
     * answer than the poll and must clear a staleness the poll had set.
     */
    it("a successful list clears a staleness the count poll set", async () => {
        useNotificationStore.setState({unreadCountStale: true});
        mockList.mockResolvedValue({state: "success", data: {notifications: [ROW]}});

        await useNotificationStore.getState().fetchNotifications();

        expect(useNotificationStore.getState().unreadCount).toBe(1);
        expect(useNotificationStore.getState().unreadCountStale).toBe(false);
    });
});
